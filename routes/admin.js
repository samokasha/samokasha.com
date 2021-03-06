var express = require('express');
var router = express.Router();
var aws = require('aws-sdk');
var multer = require('multer');
var multerS3 = require('multer-s3');
var s3 = new aws.S3({params: {Bucket: 'samsblog', Key: 'mainimages/myKey'}});
var mongoose = require('mongoose');
var customPagination = require('custom-pagination');
aws.config.update({accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY});

var upload = multer({
					storage: multerS3({
					    s3: s3,
					    bucket: 'samsblog',
							acl: 'public-read',
					    metadata: function (req, file, cb) {
					      cb(null, {fieldName: file.fieldname});
					    },
							key: function (req, file, cb) {
      					cb(null, "mainimages/" + Date.now().toString())
					    }
					  }),

					  // fileFilter: function (req, file, cb) {
						// if (file.mimetype !== 'image/jpeg') {
						//   var err;
						//   return cb(
						// 		err = {msg:'Wrong file type. Only JPG files may be used as avatars.'}
						// 	)
						// }
						// 
						// cb(null, true)
					  // },
					});

// Connect to database
var db = mongoose.createConnection('mongodb://'+process.env.MLABDB_SAMBLOG_USER+':'+process.env.MLABDB_SAMBLOG_PASS+'@ds017175.mlab.com:17175/samsblog');

var User = require('../models/user');
var Post = require('../models/post');
var Category = require('../models/category');

// Check if user is authenticated and if user is admin for all /admin/ routes
router.use('/*', function(req,res,next){
	if(req.isAuthenticated()){
		if(req.user && req.user.username === 'admin'){
			return next();
		} 
		req.flash('error', 'Restricted to admin');
		res.redirect('/blog/users/home')
	} 
	res.redirect('/blog/login');
} );


router.get('/', function(req, res, next) {
	Post.paginate({}, customPagination.paginateOptions(req), function(err, posts) {
		if (err) throw err;
		customPagination.buildPagination(req, res, posts, 'admin');
	});
});


router.get('/page/:page', function(req, res, next) {
	Post.paginate({}, customPagination.paginateOptions(req), function(err, posts) {
		if (err) throw err;
		customPagination.buildPagination(req, res, posts, 'admin');
	});
});

router.get('/show/:id', function(req, res, next) {
	Post.findOne({_id: req.params.id}, function(err, post){
		if (err) throw err;
		res.render('adminshow', {post: post});
	})
});

router.post('/delcomment', function(req, res, next) {
	
	// Get form values
	var commentid = req.body.commentid;
	var postid= req.body.postid;

	Post.findByIdAndUpdate(postid, 
		{$pull: {comments: {_id: commentid}}},
		function(err){
			if (err) throw err;
			req.flash('success', 'Comment Deleted')
			res.location('/blog/admin/show/'+postid);
			res.redirect('/blog/admin/show/'+postid);
		});

});

router.get('/category/:category', function(req, res, next) {

	Post.paginate({category:req.params.category}, customPagination.paginateOptions(req), function(err, posts) {
		customPagination.buildPagination(req, res, posts, 'admincategory');
	});
});

router.get('/category/:category/:page', function(req, res, next) {

	Post.paginate({category:req.params.category}, customPagination.paginateOptions(req), function(err, posts) {
		customPagination.buildPagination(req, res, posts, 'admincategory');
	});
});


router.get('/addpost',  function(req, res, next) {
	Category.find({}, function(err,categories){
		if (err) throw err;
		res.render('addpost', { categories: categories });
	})
});


/*Multer adds a body object and a file or files object to the request object. The body object contains the values of the text fields of the form, 
the file or files object contains the files uploaded via the form.*/
router.post('/addpost', upload.single('mainimage'), function(req, res, next) {
	// Get form values
	var title = req.body.title;
	var category = req.body.category;
	var body = req.body.body;
	var author = req.body.author;
	var date = new Date();

	if(req.file){
			console.log(req.file);
		  var mainimage = req.file.location;
	  } else {
		  var mainimage = 'noimage.jpg';
	  }


	  // Form validation (checkBody only checks req.body)
	  req.checkBody('title', 'Title field required').notEmpty();
	  req.checkBody('body', 'Body field required').notEmpty();
	  
	// Check errors
	var errors = req.validationErrors();

	var post = new Post ({
		title: title,
		category: category,
		body: body,
		author: author,
		date: date,
		mainimage: mainimage
	})
  
  if(errors){
	Category.find({}, function(err,categories){
		if (err) throw err;
		res.render('addpost', { errors: errors, categories: categories });
	})
  } else {
	  post.save(function(err){
		if (err){
			console.log(err);
		}
		else {
			req.flash('success', 'Post added');
			  res.location('/blog/admin');
			  res.redirect('/blog/admin');
		}
	})
  }

});

router.get('/settings',  function(req, res, next) {
	User.paginate({}, customPagination.userPaginateOptions(req), function(err, users) {
		if (err) throw err;
		customPagination.buildPagination(req, res, users, 'settings')
	});

});

router.get('/settings/users/:page', function(req, res, next) {
	User.paginate({}, customPagination.userPaginateOptions(req), function(err, users) {
		if (err) throw err;
		customPagination.buildPagination(req, res, users, 'settings')
	});
});

router.post('/settings/usersearch',  function(req, res, next) {
	var username= req.body.query.toLowerCase();
	req.checkBody('query', 'Please enter a username').notEmpty();

	var errors = req.validationErrors();
	
	if (errors){
		console.log(errors);
		res.render('settings', {errors: errors})
	} else {
		User.paginate({usernameLowerCase: {'$regex': username, "$options": "i" }}, customPagination.userPaginateOptions(req), function(err, users) {
			customPagination.buildPagination(req, res, users, 'settings')
		});
	}
});

router.post('/settings/usersearch/:page',  function(req, res, next) {
	var username= req.body.query.toLowerCase();

	User.paginate({usernameLowerCase: {'$regex': username, "$options": "i" }}, customPagination.userPaginateOptions(req), function(err, users) {
		customPagination.buildPagination(req, res, users, 'settings');
	});

});

router.post('/settings/suspenduser',  function(req, res, next) {
	var userid= req.body.userid;

	User.findByIdAndUpdate(userid,{$set: {suspended: true}}, function(err,users){
		if (err) throw err;
		req.flash('success', 'User Suspended')
		res.location('/blog/admin/settings/');
		res.redirect('/blog/admin/settings/');
	})
});

router.post('/settings/unsuspenduser',  function(req, res, next) {
	var userid= req.body.userid;

	User.findByIdAndUpdate(userid,{$set: {suspended: false}}, function(err,users){
		if (err) throw err;
		req.flash('success', 'User Unsuspended')
		res.location('/blog/admin/settings/');
		res.redirect('/blog/admin/settings/');
	})
});

router.post('/addcomment', function(req, res, next) {
	var postid = req.body.postid;
	var userId = req.user._id;
	var name= req.user.username;
	var body = req.body.body;
	var date = new Date();

	req.checkBody('body', 'Comment field blank').notEmpty();

	var errors = req.validationErrors();
	if (errors) {
		Post.findOne({_id: postid}, function(err, post){
		if (err) throw err;
		res.render('adminshow', {errors: errors, post: post});
		})
	} else {
		User.findById(userId, function(err, user){
			Post.findByIdAndUpdate(postid, 
			{$push: {comments: {name: name, avatar: user.avatar, socialMediaProfilePhoto: user.socialMediaProfilePhoto , body: body, date: date}}}, 
			{safe: true, upsert: true},
			function(err, post){
				if (err) throw err;
				req.flash('success', 'Comment Added')
				res.location('/blog/admin/show/'+postid);
				res.redirect('/blog/admin/show/'+postid);
			});
		});
	}	
});

router.get('/editpost/:id', function(req, res, next) {
	Post.findOne({_id: req.params.id}, function(err, post){
		if (err) throw err;
		res.render('editpost', {post: post});
	})
});

router.post('/editpost',  function(req, res, next) {
	// Get form values
	var postid = req.body.postid;
    var newtitle = req.body.title;
	var newbody = req.body.body;

	req.checkBody('title', 'Title field is required').notEmpty();
	req.checkBody('body', 'Body field is required').notEmpty();

	// Check errors
	var errors = req.validationErrors();

	if (errors){
		Post.findOne({_id: postid}, function(err, post){
			if (err) throw err;
			res.render('editpost', {post: post, errors: errors});
		})
	} else {
		// Note: in Express 4.0 'new' option set to false by default. Must change to true for changes to take effect in document 
		Post.findByIdAndUpdate(postid, { $set: { title: newtitle, body: newbody }},{new: true}, function (err, post) {
			if (err) return err;
			req.flash('success', 'Post modified');
			res.location('/blog/admin');
			res.redirect('/blog/admin');
		});
	}
});

router.post('/deletepost',  function(req, res, next) {
	// Get form values
	var postid = req.body.postid;
	Post.findById(postid).remove(function(err){
		if (err) throw err;
		req.flash('success', 'Post deleted');
		res.location('/blog/admin');
		res.redirect('/blog/admin');
	});


});

router.get('/addcategory', function(req, res, next) {
		Category.find({},function(err,categories){
			if (err) throw err;
			res.render('addcategory', {categories: categories});
		})
});

router.post('/addcategory', function(req, res, next) {
	// Get form values
	var name = req.body.name;
	// Form validation (checkBody only checks req.body)
	req.checkBody('name', 'Category field is required').notEmpty();

	// Check errors
	var errors = req.validationErrors();

	var category = new Category ({
		name: name
	})
  if(errors){
	  Category.find({},function(err,categories){
			if (err) throw err;
			res.render('addcategory', {categories: categories, errors: errors});
		})
  } else {
	  category.save(function(err){
		if (err){
			console.log(err);
		}
		else {
			req.flash('success', 'Category added');
			  res.location('/blog/admin/addcategory');
			  res.redirect('/blog/admin/addcategory');
		}
	})
  }

});


router.post('/delcategory', function(req, res, next) {
	// Get form values
	var categoryid = req.body.categoryid;
	Category.findByIdAndRemove(categoryid, function(err){
		if (err) throw err;
		req.flash('success', 'Category deleted');
		res.location('/blog/admin/addcategory');
		res.redirect('/blog/admin/addcategory');
	});


});

router.get('/logout', function(req, res){
	req.logout();
	req.flash('success', 'You are now logged out');
	res.redirect('/blog/login');
})

module.exports = router;
