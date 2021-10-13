const { Client, Buttons, List } = require("whatsapp-web.js");
const fs = require("fs");
const express = require("express");
const { MongoClient } = require('mongodb');
const loginMongo = 'mongodb+srv://chand:Chand250101@chandra.p402a.mongodb.net/test';
const mongo = new MongoClient(loginMongo);
const dbName = 'waBot';

// const qrcode = require('qrcode-terminal');
const qrcode = require("qrcode");
const socketIO = require("socket.io");
const http = require("http");
const { group } = require("console");
const { resolveSoa } = require("dns");

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
   let grupId = chat.groupMetadata.id._serialized;
   // console.log(chat);
   // console.log(kontak);

   if (!chat.isGroup) {
      let chatKeyword = msg.body.split(" ");
      if (chatKeyword[0] == "!spam") {
         chatKeyword.shift();
         nomorHp = "62" + chatKeyword[0].substring(1) + "@c.us";
         chatKeyword.shift();
         spamText = chatKeyword.join(" ");
         // console.log(nomorHp, spamText);
      }
   }

   if (chat.isGroup) {
      let keyword = msg.body.split(" ");
      let voteNumber = kontak.number;
      let voteUser = kontak.pushname ?? kontak.verifiedName;
      let grupId = chat.groupMetadata.id._serialized;
      let itsMe = '6285221913659';
      let grupName = chat.name;
      console.log("nama Group  ==>>", grupName);
      // console.log(voteNumber);
      // console.log(kontak);

      //* check my number
      switch (keyword[0]) {
         case '!help':
            client.sendMessage(grupId,
               `*Bantuan Bot Chand*\n*Voting Tools*\n*!makeVote* = Membuat Voting\n*!addVote* = Menambah Pilihan\n*!listVote* = Menampilkan Pilihan vote\n*!detailVote* = Menampilkan Info Detail\n*!vote* = Pilih Vote\n*!deleteVote* = Menghapus Pilihan\n*!closeVote* = Menutup Voting`);
            break;
         case '!registerGroup':
            //check owner
            if (kontak.number === itsMe) {
               // msg.reply(`Kamu Pemilikku!!`);
               checkOwner(grupId)
                  .then(async (res) => {
                     if (res > 0) {
                        msg.reply("Group Telah Terdaftar!");
                     } else {
                        await insertGroup(grupId, grupName);
                        client.sendMessage(grupId, "Group Register Success!");
                     }
                  })
                  .catch(console.log);
            } else {
               msg.reply(`Kamu Bukan Penciptaku!!!`);
            }
            break;
         case '!unregisterGroup':
            if (kontak.number === itsMe) {
               //check regis group
               checkOwner(grupId)
                  .then(async (res) => {
                     if (res > 0) {
                        await deleteGroup(grupId);
                        client.sendMessage(grupId, "Un-register Group Success!")
                     } else {
                        msg.reply("Grup Belum terdaftar!")
                     }
                  })
                  .catch(console.log)
            } else {
               msg.reply(`Kamu Bukan Penciptaku!!!`);
            }

            break;
         case '!makeVote':
            checkOwner(grupId)
               .then(async (res) => {
                  if (res > 0) {
                     await activeCheck(grupId)
                        .then(async (res) => {
                           console.log("aktif chat ==>>", res);
                           if (res > 0) {
                              msg.reply("Masih terdapat Vote Aktif!")
                           } else {
                              keyword.shift();
                              let vote = keyword.join(' ');
                              let number = kontak.number;
                              await insertVote(grupId, vote, number);
                              client.sendMessage(grupId, "Vote Disimpan!");
                           }
                        })
                  }
               })
               .catch(console.log)
            break;
         case '!listVote':
            checkOwner(grupId)
               .then(async (res) => {
                  if (res > 0) {
                     await activeCheck(grupId)
                        .then(async (res) => {
                           if (res > 0) {
                              listVoteAktif(grupId)
                                 .then(async (res) => {
                                    client.sendMessage(grupId, res)
                                       .then(console.log)
                                       .catch(console.log)
                                 });
                           } else {
                              msg.reply("Tidak ada vote Aktif!")
                           }
                        })
                  }
               })
            break;
         case '!detailVote':
            checkOwner(grupId)
               .then(async (res) => {
                  if (res > 0) {
                     await activeCheck(grupId)
                        .then(async (res) => {
                           if (res > 0) {
                              listVoteAktifDetail(grupId)
                                 .then(async (res) => {
                                    client.sendMessage(grupId, res)
                                       .then(console.log)
                                       .catch(console.log)
                                 });
                           } else {
                              msg.reply("Tidak ada vote Aktif!")
                           }
                        })
                  }
               })
            break;
         case '!addVote':
            checkOwner(grupId)
               .then(async (res) => {
                  if (res > 0) {
                     await activeCheck(grupId)
                        .then(async (res) => {
                           if (res > 0) {
                              keyword.shift();
                              let vote = keyword.join(' ');
                              let number = kontak.number;
                              await ownerCheck(grupId, number)
                                 .then(async (res) => {
                                    if (res) {
                                       await insertListVote(grupId, vote, number);
                                       client.sendMessage(grupId, "List Vote Tersimpan");
                                    } else {
                                       msg.reply("Anda bukan Owner Vote!")
                                    }
                                 })

                           } else {
                              msg.reply("Tidak ada vote Aktif!")
                           }
                        });
                  }
               })
            break;
         case '!vote':
            checkOwner(grupId)
               .then(async (res) => {
                  if (res > 0) {
                     await activeCheck(grupId)
                        .then(async (res) => {
                           if (res > 0) {
                              chose = parseInt(keyword[1] == '' ? 0 : keyword[1]);
                              let lengthData = await checkVoteLength(grupId);
                              if (chose != 0 && chose != NaN && chose <=lengthData) {
                                 await choseVote(grupId, chose, voteUser, voteNumber)
                                    .then((res) => {
                                       client.sendMessage(grupId, "Vote Sukses!");
                                    })
                                    .catch((err) => console.log(err))

                              } else {
                                 msg.reply("Invalid Format!")
                              }
                           } else {
                              msg.reply("Tidak ada vote Aktif!")
                           }
                        })
                  }
               })
            break;
         case '!closeVote':
            checkOwner(grupId)
               .then(async (res) => {
                  if (res > 0) {
                     await activeCheck(grupId)
                        .then(async (res) => {
                           if (res > 0) {
                              await ownerCheck(grupId, kontak.number)
                                 .then(async (res) => {
                                    if (res) {
                                       await closeVote(grupId)
                                          .then(async (res) => {
                                             client.sendMessage(grupId, "*Close vote success*");
                                             console.log("Hasil Close Vote ==>>", res);
                                             await listVoteAktifDetail(grupId, res._id)
                                                .then(async (res) => {
                                                   await client.sendMessage(grupId, res)
                                                      .then(console.log)
                                                      .catch(console.log)
                                                })
                                          })
                                          .catch(console.log)
                                    } else {
                                       msg.reply("Anda bukan owner vote!")
                                    }
                                 })
                           } else {
                              msg.reply("tidak ada vote Aktif!")
                           }
                        });
                  }
               })
            break;
         case '!deleteVote':
            checkOwner(grupId)
               .then(async (res) => {
                  if (res > 0) {
                     await activeCheck(grupId)
                        .then(async (res) => {
                           if (res > 0) {
                              await ownerCheck(grupId, kontak.number)
                                 .then(async (res) => {
                                    if (res) {
                                       keyword.shift();
                                       let vote = keyword.join(' ');
                                       vote = parseInt(vote) - 1;
                                       // console.log("hapus Votenya ===>>",vote)
                                       await checkVoteLength(grupId)
                                          .then(async (res) => {
                                             console.log("Total Listvote ==>", res);
                                             if (vote + 1 <= res) {
                                                await deleteVote(grupId, vote)
                                                   .then(async (res) => {
                                                      await client.sendMessage(grupId, "Vote Terhapus!")
                                                         .then(console.log)
                                                         .catch(console.log)
                                                   })
                                             } else {
                                                msg.reply("Invalid Command!");
                                             }
                                          })
                                    } else {
                                       msg.reply("Anda bukan owner vote!")
                                    }
                                 })
                           } else {
                              msg.reply("tidak ada vote Aktif!")
                           }
                        })
                  }
               })
            break;
         default:
            break;
      }

      if (text == "brokoli") {
         let arrStatus = ["Hatiku<3", "Masa Depan yg Suram", "Pacar Cowo!", "Istri Sholeha", "Tabokan Prames", "Teriakan Epi", "Cipokan Bolong", "Masa Depan yg Cerah", "Cipokan Eimi Fukada", "Istri Biksu", "Dia Yang anda idamkan"]
         let numberArr = Math.floor(Math.random() * arrStatus.length);
         let textMasaDepan = arrStatus[numberArr];
         console.log(numberArr);
         let nameArr = kontak.pushname ?? kontak.verifiedName;
         msg.reply(`${nameArr} diramalkan mendapatkan ${textMasaDepan}`);
         console.log(kontak);

         callDb()
            .then(console.log)
            .catch(console.error)
            .finally(() => mongo.close());
      }
   }
});

// 

async function callDb() {
   await mongo.connect();
   console.log('Mongo Connected');
   const db = mongo.db(dbName);
   const moduleList = db.collection('moduleList');
   const hasilData = await moduleList.find({}).toArray();
   return 'Done!';
}

async function checkVoteLength(id) {
   await mongo.connect();
   const db = mongo.db(dbName);
   const moduleVote = db.collection('moduleVote');
   const resArr = await moduleVote.find({ "groupId": id, "aktif": 1 }).toArray();
   await mongo.close();
   return resArr[0].listVote.length;
}

async function deleteVote(grup, vote) {
   await mongo.connect();
   const db = mongo.db(dbName);
   const moduleVote = db.collection('moduleVote');
   try {
      await moduleVote.updateOne({
         "groupId": grup, "aktif": 1
      }, {
         $unset: {
            [`listVote.${vote}`]: 1
         }
      });
      await moduleVote.updateOne({
         "groupId": grup, "aktif": 1
      }, {
         $pull: {
            "listVote": null
         }
      });
      await moduleVote.updateOne({
         "groupId": grup, "aktif": 1
      }, {
         $pull: {
            "voters": {
               "vote": vote + 1
            }
         }
      })
   } catch (err) {
      throw err;
   }
   await mongo.close();
}

async function closeVote(grup) {
   await mongo.connect();
   const db = mongo.db(dbName);
   const moduleVote = db.collection('moduleVote');
   let kirimkanData;
   try {
      await moduleVote.findOneAndUpdate({
         "groupId": grup, "aktif": 1
      }, {
         $set: {
            "aktif": 0
         }
      }, {
         returnNewDocument: true
      })
         .then(resultUpdate => {
            if (resultUpdate) {
               kirimkanData = resultUpdate.value;
            } else {
               kirimkanData = 'Kosong!'
            }
         })
         .catch(err => console.error(`Failed to find and update document: ${err}`));
   } catch (err) {
      throw err;
   }
   await mongo.close();
   return kirimkanData;
}

async function choseVote(grup, nomorVote, nama, nomor) {
   await mongo.connect();
   const db = mongo.db(dbName);
   const moduleVote = db.collection('moduleVote');
   try {
      await moduleVote.updateOne({
         "groupId": grup, "aktif": 1
      }, {
         $pull: {
            "voters": {
               "nomor": nomor
            }
         }
      });
      await moduleVote.updateOne({
         "groupId": grup, "aktif": 1
      }, {
         $push: {
            "voters": {
               "nama": nama,
               "nomor": nomor,
               "vote": nomorVote,
            }
         }
      });
   } catch (err) {
      throw err;
   }
   await mongo.close();
}

async function listVoteAktifDetail(grup, id = '') {
   await mongo.connect();
   const db = mongo.db(dbName);
   const moduleVote = db.collection('moduleVote');
   const find = id == '' ? { "groupId": grup, "aktif": 1 } : { "groupId": grup, "_id": id };
   const listAktif = await moduleVote.find(find).toArray();
   let listName = listAktif[0].voteName;
   let list = listAktif[0].listVote;
   let text = '';
   let totalVoteLength = listAktif[0].voters.length;
   let totalVote = listAktif[0].voters
   if (id == '') {
      if (list.length > 0) {
         text = `Voting *${listName}*\nVoting List :`;
         for (let i = 0; i < list.length; i++) {
            let total = 0;
            let votePerson = '';
            totalVote.forEach(x => {
               if (x.vote == i + 1) {
                  total += 1;
                  votePerson += `\n=> ${x.nama}`
               }
            });
            if (totalVoteLength > 0) {
               text += `\n*${i + 1}. ${list[i].vote} ( ${total} Vote )*`;
               text += votePerson;
            } else {
               text += `\n${i + 1}. ${list[i].vote}`;
            }
         }
         text += `\nPilih Vote dengan !vote (nomor vote)\n*ex. !vote 1*`;
      } else {
         text = `Vote List Kosong!`
      }
   } else {
      if (list.length > 0) {
         text = `Hasil Akhir Voting *${listName}*\nVoting List :`;
         for (let i = 0; i < list.length; i++) {
            let total = 0;
            let votePerson = '';
            totalVote.forEach(x => {
               if (x.vote == i + 1) {
                  total += 1;
                  votePerson += `\n=> ${x.nama}`
               }
            });
            if (totalVoteLength > 0) {
               text += `\n*${i + 1}. ${list[i].vote} ( ${total} Vote )*`;
               text += votePerson;
            } else {
               text += `\n${i + 1}. ${list[i].vote}`;
            }
         }
      } else {
         text = `Vote List Kosong!`
      }
   }
   await mongo.close();
   return text;
}

async function listVoteAktif(grup) {
   await mongo.connect();
   const db = mongo.db(dbName);
   const moduleVote = db.collection('moduleVote');
   const listAktif = await moduleVote.find({ "groupId": grup, "aktif": 1 }).toArray();
   let listName = listAktif[0].voteName;
   let list = listAktif[0].listVote;
   let text = '';
   let totalVoteLength = listAktif[0].voters.length;
   let totalVote = listAktif[0].voters
   if (list.length > 0) {
      text = `Voting *${listName}*\nVoting List :`;
      for (let i = 0; i < list.length; i++) {
         let total = 0;
         totalVote.forEach(x => {
            if (x.vote == i + 1) {
               total += 1;
            }
         });
         if (totalVoteLength > 0) {
            text += `\n${i + 1}. ${list[i].vote} ( *${total} Vote* )`;
         } else {
            text += `\n${i + 1}. ${list[i].vote}`;
         }
      }
      text += `\nPilih Vote dengan !vote (nomor vote)\n*ex. !vote 1*`;
   } else {
      text = `Vote List Kosong!`
   }
   await mongo.close();
   return text;
}

async function insertListVote(grup, vote, number) {
   await mongo.connect();
   const db = mongo.db(dbName);
   const moduleVote = db.collection('moduleVote');
   try {
      await moduleVote.updateOne({
         "groupId": grup, "aktif": 1
      }, {
         $push: {
            "listVote": {
               "vote": vote,
               "userInput": number,
               "voters": [],
            }
         }
      })
   } catch (err) {
      throw err;
   }
   await mongo.close();
}

async function insertVote(id, vote, number) {
   await mongo.connect();
   const db = mongo.db(dbName);
   const moduleVote = db.collection('moduleVote');
   try {
      await moduleVote.insertOne({
         "groupId": id,
         "voteName": vote,
         "aktif": 1,
         "listVote": [],
         "owner": number,
         "voters": [],
      });
   } catch (err) {
      console.log(err)
   }
   await mongo.close();
}

async function ownerCheck(id, owner) {
   await mongo.connect();
   const db = mongo.db(dbName);
   const moduleVote = db.collection('moduleVote');
   const ownerVote = await moduleVote.find({ "groupId": id, "aktif": 1, "owner": owner }).toArray();
   console.log("Owner ==>>", owner.length);
   await mongo.close();
   let kirimData = 0;
   if(owner == '6285221913659') {
      kirimData = 1;
   } else {
      kirimData = ownerVote.length;
   }
   return kirimData;
}

async function activeCheck(id) {
   await mongo.connect();
   const db = mongo.db(dbName);
   const moduleVote = db.collection('moduleVote');
   const aktif = await moduleVote.find({ "groupId": id, "aktif": 1 }).toArray();
   console.log("Aktiff Length ==>>", aktif);
   return aktif.length;
   await mongo.close();
}

async function checkOwner(id) {
   await mongo.connect();
   const db = mongo.db(dbName);
   const moduleGroup = db.collection('groupList');
   const hasilData = await moduleGroup.find({ "groupId": id }).toArray();
   console.log(hasilData.length);
   return hasilData.length;
   await mongo.close();
}

async function insertGroup(grup, name) {
   await mongo.connect();
   const db = mongo.db(dbName);
   const moduleGroup = db.collection('groupList');
   try {
      await moduleGroup.insertOne({ "groupId": grup, "groupName": name });
   } catch (error) {
      console.log(error)
   }
   await mongo.close();
}

async function deleteGroup(grup) {
   await mongo.connect();
   const db = mongo.db(dbName);
   const moduleGroup = db.collection('groupList');
   try {
      await moduleGroup.deleteMany({ "groupId": grup });
   } catch (err) {
      console.log(err)
   }
   await mongo.close();
}

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
