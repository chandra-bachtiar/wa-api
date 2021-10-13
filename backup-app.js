const { Client, Buttons, List } = require("whatsapp-web.js");
const fs = require("fs");
const express = require("express");
const fb = require("node-firebird");
let conect = {
   host: "localhost",
   port: 3050,
   database: "vote",
   user: "SYSDBA",
   password: "chand",
   lowercase_keys: false, // set to true to lowercase keys
   role: null, // default
   pageSize: 4096,
};
// const qrcode = require('qrcode-terminal');
const qrcode = require("qrcode");
const socketIO = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SESSION_FILE_PATH = "./session.json";

let sessionData;
if (fs.existsSync(SESSION_FILE_PATH)) {
   sessionData = require(SESSION_FILE_PATH);
}

//apps web
app.get("/", (req, res) => {
   // res.send('Hello World!')
   res.sendFile("index.html", { root: __dirname });
});

const client = new Client({
   session: sessionData,
   puppeteer: {
      args: [
         "--no-sandbox",
         "--disable-setuid-sandbox",
         "--disable-dev-shm-usage",
         "--disable-accelerated-2d-canvas",
         "--no-first-run",
         "--no-zygote",
         "--single-process", // <- this one doesn't works in Windows
         "--disable-gpu",
      ],
      headless: true,
   },
});

client.on("authenticated", (session) => {
   sessionData = session;
   fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
      if (err) {
         console.log(err);
      }
   });
});

client.on("message", async (msg) => {
   let text = msg.body.toLowerCase();
   let chat = await msg.getChat();
   let kontak = await msg.getContact();
   // console.log(chat);
   // console.log(kontak);

   if (!chat.isGroup) {
      let chatKeyword = msg.body.split(" ");
      if (chatKeyword[0] == "!spam") {
         chatKeyword.shift();
         nomorHp = "62" + chatKeyword[0].substring(1) + "@c.us";
         chatKeyword.shift();
         spamText = chatKeyword.join(" ");
         console.log(nomorHp, spamText);

         // for (let i = 0; i < 10; i++) {
         //    setTimeout(() => {
         //       client
         //          .sendMessage(nomorHp, spamText)
         //          .then((res) => console.log(res))
         //          .catch((err) => console.log(err));
         //    }, 5000);
         // }
      }
   }

   if (chat.isGroup) {
      let keyword = msg.body.split(" ");

      let voteNumber = kontak.number;
      let voteUser = kontak.pushname ?? kontak.verifiedName;
      let grupId = chat.groupMetadata.id._serialized;

      if (keyword[0] == "!makeVote") {
         keyword.shift();
         let voteName = keyword.join(" ");
         //check is there any vote in group ?
         fb.attach(conect, function (err, db) {
            if (err) throw err;
            db.query(`SELECT FIRST 1 ID_VOTE, NAME_VOTE, USER_INPUT FROM MASTER_VOTE WHERE GROUP_ID = ? AND COALESCE(AKTIF,0) = 1`, [grupId], function (err, res) {
               // console.log(res.length);
               if (res.length <= 0) {
                  // insert new vote
                  fb.attach(conect, function (err, db) {
                     if (err) throw err;
                     db.transaction(fb.ISOLATION_READ_COMMITED, function (err, transaction) {
                        transaction.query(
                           "INSERT INTO MASTER_VOTE(NAME_VOTE,USER_INPUT,INPUT_TIME,USER_NUMBER,GROUP_ID,AKTIF) VALUES(?,?,CURRENT_TIMESTAMP,?,?,1) RETURNING ID_VOTE",
                           [voteName, voteUser, voteNumber, grupId],
                           function (err, hasil) {
                              if (err) {
                                 console.log(err);
                                 transaction.rollback();
                                 return;
                              }
                              transaction.commit(function (err) {
                                 if (err) {
                                    console.log(err);
                                    transaction.rollback();
                                 } else {
                                    id_result = hasil.ID_VOTE;
                                    client
                                       .sendMessage(
                                          grupId,
                                          `*VOTING DISIMPAN ID ${id_result}*
voting *${voteName}*
Masukan pilihan vote dengan Perintah 
*!addVote (id vote) (pilihan)*
E.g !addVote 1 Eimi Fukada
Lakukan beberapa kali jika terdapat lebih dari 1 pilihan`
                                       )
                                       .then((res) => console.log(res))
                                       .catch((err) => console.log(err));
                                    db.detach();
                                 }
                              });
                           }
                        );
                     });
                  });
                  // msg.reply("Kosong!");
               } else {
                  client
                     .sendMessage(
                        grupId,
                        `Group Masih Memiliki Vote Aktif
Voting ID : ${res[0].ID_VOTE}
Voting : ${res[0].NAME_VOTE}
Owner : ${res[0].USER_INPUT}
Close Vote Terlebih dahulu!`
                     )
                     .then((res) => console.log(res))
                     .catch((err) => console.log(err));
                  db.detach();
               }
            });
         });
      }

      //add vote list
      if (keyword[0] == "!addVote") {
         keyword.shift();
         let idVote = keyword[0];
         keyword.shift();
         let vote = keyword.join(" ").toUpperCase();
         let owner = 0;
         let duplicate = 0;
         fb.attach(conect, function (err, db) {
            if (err) throw err;
            //check owner
            db.query(`SELECT FIRST 1 ID_VOTE, NAME_VOTE, USER_INPUT FROM MASTER_VOTE WHERE GROUP_ID = ? AND USER_NUMBER = ? AND ID_VOTE = ?`, [grupId, voteNumber, idVote], function (err, res) {
               //? cheking the vote master
               if (res) {
                  //check duplicate data
                  db.query(`SELECT FIRST 1 VOTE FROM DETAIL_VOTE WHERE ID_VOTE = ? and UPPER(VOTE) = ?`, [idVote, vote], function (err, res) {
                     //? checking duplicate data in detail
                     if (res.length > 0) {
                        client
                           .sendMessage(grupId, `Pilihan Tersebut Sudah ada :(`)
                           .then((res) => console.log(res))
                           .catch((err) => console.log(err));
                        db.detach();
                     } else {
                        db.transaction(fb.ISOLATION_READ_COMMITED, function (err, transaction) {
                           transaction.query("INSERT INTO DETAIL_VOTE(ID_VOTE,USER_INPUT,VOTE) VALUES(?,?,?)", [idVote, voteNumber, vote], function (err, hasil) {
                              if (err) {
                                 console.log(err);
                                 transaction.rollback();
                                 return;
                              }
                              transaction.commit(function (err) {
                                 if (err) {
                                    console.log(err);
                                    transaction.rollback();
                                 } else {
                                    client
                                       .sendMessage(grupId, `*Vote Disimpan!*`)
                                       .then((res) => console.log(res))
                                       .catch((err) => console.log(err));
                                    db.detach();
                                 }
                              });
                           });
                        });
                     }
                  });
               } else {
                  client
                     .sendMessage(grupId, `Kesalahan Penulisan atau Vote Ownernya bukan anda :(`)
                     .then((res) => console.log(res))
                     .catch((err) => console.log(err));
                  db.detach();
               }
            });
            // if(owner == 1) {
            //    if(duplicate == 1) {
            //       client
            //       .sendMessage(
            //          grupId,
            //          `Pilihan Tersebut sudah ada :)`
            //       )
            //       .then((res) => console.log(res))
            //       .catch((err) => console.log(err));
            //       db.detach();
            //    } else {
            //       db.transaction(fb.ISOLATION_READ_COMMITED, function (err, transaction) {
            //          transaction
            //          .query(`INSERT INTO DETAIL_VOTE(ID_VOTE,USER_INPUT,VOTE) VALUES(?,?,?)`,
            //          [idVote, userId, vote],
            //          function (err, hasil) {
            //             if (err) {
            //                console.log(err);
            //                transaction.rollback();
            //                return;
            //             }
            //             transaction.commit(function (err) {
            //                if (err) {
            //                   console.log(err);
            //                   transaction.rollback();
            //                } else {
            //                   console.log("Inserted!");
            //                   client
            //                      .sendMessage(
            //                         grupId,
            //                         `Option Vote Saved!`
            //                      )
            //                      .then((res) => console.log(res))
            //                      .catch((err) => console.log(err));
            //                   db.detach();
            //                }
            //             });
            //          });
            //       });
            //    }
            // } else {
            //    client
            //    .sendMessage(
            //       grupId,
            //       `Maaf, Owner votenya bukan anda :(`
            //    )
            //    .then((res) => console.log(res))
            //    .catch((err) => console.log(err));
            //    db.detach();
            // }
         });
      }

      //insert data
      //  fb.attach(conect, function (err, db) {
      //     if (err) throw err;
      //     db.transaction(fb.ISOLATION_READ_COMMITED, function (err, transaction) {
      //        transaction.query("INSERT INTO MASTER_VOTE(NAME_VOTE,USER_INPUT,INPUT_TIME,USER_NUMBER) VALUES(?,?,CURRENT_TIMESTAMP,?)", [voteName, voteUser,voteNumber], function (err, result) {
      //           if (err) {
      //              console.log(err);
      //              transaction.rollback();
      //              return;
      //           }
      //           transaction.commit(function (err) {
      //              if (err) {
      //                 console.log(err);
      //                 transaction.rollback();
      //              } else {
      //                 console.log("Inserted!");
      //                 db.detach();
      //              }
      //           });
      //        });
      //     });
      //  });
   } else {
      console.log("Not Group Message! =>", text);
      console.log("Not Group Message! =>", kontak);
   }

   if (text == "bro") {
      let arrStatus = ["Hatiku<3","Masa Depan yg Suram","Pacar Cowo!","Istri Sholeha","Tabokan Prames","Teriakan Epi","Cipokan Bolong","Masa Depan yg Cerah","Cipokan Eimi Fukada","Istri Biksu","Dia Yang anda idamkan"]
      let numberArr = Math.floor(Math.random() * arrStatus.length);
      let textMasaDepan = arrStatus[numberArr];
      console.log(numberArr);
      let nameArr = kontak.pushname ?? kontak.verifiedName;
      msg.reply(`${nameArr} diramalkan mendapatkan ${textMasaDepan}`);
      console.log(kontak);
      // fb.attach(conect, function(err,db) {
      //     if(err) throw err;
      // db.query(`INSERT INTO MASTER_VOTE(NAME_VOTE) VALUES (${text})`, function(err,res){
      //     console.log(res);
      //     db.commit();
      // console.log(res[0].NAME_VOTE)
      // text = res[0].NAME_VOTE;
      // msg.reply(res[0].NAME_VOTE);
      //     db.detach();
      // });
      //     db.transaction(fb.ISOLATION_READ_COMMITED, function(err, transaction) {
      //         transaction.query('INSERT INTO MASTER_VOTE(NAME_VOTE,USER_INPUT) VALUES(?,?)', ['TEST DARI WA', 'CHANDRA'], function(err, result) {

      //             if (err) {
      //                 console.log(err);
      //                 transaction.rollback();
      //                 return;
      //             }

      //             transaction.commit(function(err) {
      //                 if (err) {
      //                     console.log(err);
      //                     transaction.rollback();
      //                 } else {
      //                     console.log('Inserted!')
      //                     db.detach();
      //                 }
      //             });
      //         });
      //     });
      // });
      // console.log(text);
      // msg.reply(text);
   }
});

// app.post('/sendMessage', (req,res) => {
//     // console.log(req.body.number);
//     const number = req.body.number;
//     const message = req.body.textValue;

//     client.sendMessage(number,message);
//     // ('Sukses');
//     // client.sendMessage(number,message).then(respone => {
//     //     res.status(200).json({
//     //         status: true,
//     //         respone: respone
//     //     })
//     // }).catch(err => {
//     //     res.status(500).json({
//     //         status: false,
//     //         respone: err
//     //     })
//     // });
// });

client.initialize();

//socket IO
io.on("connection", function (soc) {
   soc.emit("message", "Menyambungkan...");

   client.on("qr", (qr) => {
      // Generate and scan this code with your phone
      console.log("QR RECEIVED", qr);
      qrcode.toDataURL(qr, (err, url) => {
         soc.emit("qr", url);
         soc.emit("message", "QR Code Ready!");
      });
      // qrcode.generate(qr,{small: true});
   });

   client.on("ready", () => {
      soc.emit("message", "Whatsapp Client Ready to Use!");
      console.log("Whatsapp Client Ready to Use!");
   });
});

server.listen(3030, function () {
   console.log("Web Is Ready on Port 3000");
});
