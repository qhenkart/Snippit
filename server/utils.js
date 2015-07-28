'use strict';

var _ = require('underscore');
var client = require('./config/mongo');
var ObjectId = require('mongodb').ObjectID;

// Util function for routes asking for user data.
// Takes a request, a response, and a callback.
exports.grabData = function(req, res, cb){
  var hasToken = false;
  client.then(function(db){
    return db.collection('users').findOneAsync({id:req.user.id});
  })
  .then(function(user){
    if (!user) {
      console.log('Error, User Not Found in Utils Grab Data');
    } else {
      cb(JSON.stringify(user.data));
    }
  });
};

// Util function for getting photos for a particular album. Takes a request,
// a response, an album object, data to look through, and a callback.
exports.getAlbumPhotos = function(req, res, album, data, cb){
  var temp ={};
  temp[album.name] = {};
  _.each(JSON.parse(data).data, function(photo){
    temp[album.name][photo.id] = {src: photo.source, thumb: photo.picture};
  });
  cb(JSON.stringify(temp));
};

// Util function for handling the Albums recieved for routes before sending
// them to the user. Takes a request, a response, a data object with Album
// information, and a callback.
exports.handleAlbums = function(req, res, data, cb){

  var albums = {};
  _.each(JSON.parse(data).data, function(album){
    albums[album.name] = {name: album.name, id: album.id};
  });
  cb(JSON.stringify(albums));
};

// Util function for adding a snip to the Database. Takes a request, a response,
// and a callback.
exports.addSnip = function(req, res, cb){
  var snip = {
    name: req.body.name,
    img: req.body.img
  };
  client.then(function(db) {
    db.collection('snips').insert(snip, cb);
  });
};

// Queries the database for snips based on it's unique ID. Then assigns
// each result to the snips object with key unique ID and value as the snip.
// callback with the snips object, which gets sent back to the request.
exports.getSnips = function(req, res, cb){
  var length = req.body.snips.length || 0;
  var snips = {};
  client.then(function(db) {
    for (var i = 0; i < length; i++) {
      db.collection('snips').findOneAsync({_id: ObjectId(req.body.snips[i])})
        .then(function(snip){
          snips[snip._id] = snip;
          if(req.body.snips.length === Object.keys(snips).length) {
            cb(JSON.stringify(snips))
          }
       });
    };
  });
};

//connects a new snip to the user owner
exports.connectSnip = function(snipId, fbId) {
  client.then(function(db){
    db.collection('users').update({id: fbId}, {$push: {
        snips: snipId
    }});
  });
};

// Util function for saving an updated snip to the Database.
// Takes a request, a response, and a callback.
exports.saveSnip = function(req, res, cb){
  client.then(function(db){
    db.collection('snips').update({_id: ObjectId(req.body._id)}, {$set: {
      img: req.body.img
    }});
  });
};


// exports.getSnips = function(req, res, cb){
//   client.then(function(db){
//     db.collection('snips').findAsync()
//     .then(function(item) {
//       item.toArray(function(err, snips) {
//         console.log('snips', snips);
//         cb(snips);
//       })
//     })
//   });
// };

// Deletes a snip from the database based on an identifying piece of information
// for that snip, such as snip name or ID.
exports.deleteSnip = function(req, res, cb){
  client.then(function(db){
    console.log('DELETING NAME', req.body._id);
    db.collection('snips').remove({_id: new ObjectId(req.body._id)});
  });
  client.then(function(db){
    console.log("removing from user");
    return db.collection('users').findOneAsync({id: req.user.id})
    .then(function(user){
      user.snips.splice()
      db.collection('users').update(
        {_id: user._id},
        {$pull: {snips: new ObjectId(req.body._id)}}
      );
    });
  });
};

// Util function for getting user's Facebook wall photos.
// Takes a request, a response, a data object, and a callback.
exports.FBWallPhotos = function(req, res, data, cb){
  var snip = {name: 'FB Wall Photos', img: {}}
  client.then(function(db){
    return db.collection('users').findOneAsync({id: req.user.id})
    .then(function(user){
      if(!user) {
        console.log('ERROR, USER NOT FOUND, UTILS FBWallPhotos');
      }else{
        var dat = JSON.parse(data);
        var datas = {};
        datas.wallPhotos = {};
        datas.wallPhotos.picture = [];
        datas.wallPhotos.id = [];
        datas.wallPhotos.thumbnail = [];
        _.each(dat.data, function(post){
          datas.wallPhotos.picture.push(post.source);
          datas.wallPhotos.id.push(post.id);
          datas.wallPhotos.thumbnail.push(post.picture);
          snip.img[post.id] = {src: post.source, thumb: post.picture}
        });


        db.collection('users').update(
          {_id: user._id},
          {$set: {data: datas}}
        );


      }
        db.collection('snips').insert(snip, function(err, id){
          db.collection('users').update({id: req.user.id}, {$push: {
            snips: id.ops[0]._id
          }});
        });
      
      
    }).then(function(){
      db.collection('users').findOneAsync({id:req.user.id})
      .then(function(user) {
        
        console.log('USER', user);
        cb(JSON.stringify(user.data));
      });
    });
  });
};


exports.refreshInstagramToken = function(req, res, data, cb){
  client.then(function(db){
    return db.collection('users').findOneAsync({id: req.user.id})
      .then(function(user){
        if(!user){
          console.log("ERROR, USER NOT FOUND UTILS addinstagramuser");
        }else{
          db.collection('users').update({_id: user._id},
            {$set:
              {
                instagramToken: data.access_token,
                instagramId: data.user.id
              }
            }
          );
        }
      }).then(function(){
        db.collection('users').findOneAsync({id:req.user.id})
          .then(function(user){
            cb(user);
          });
      });
  });
};

exports.deleteAccount = function(req, res, cb){
  client.then(function(db){
    return db.collection('users').findOneAsync({id: req.user.id})
      .then(function(user){
        if(!user){
          console.log("ERROR, USER NOT FOUND UTILS deleteAccount");
        }else{
          db.collection('users').remove({_id: ObjectId(user._id)});
          console.log('account deleted');
          cb();
        }
      })
  });
}
