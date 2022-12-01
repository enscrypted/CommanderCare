var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');

/* GET home page. */
router.get('/', function(req, res, next) {
  
  let imgPath = './public/images/work/';
  
  let folders = fs.readdirSync(imgPath);
  
  let images = folders.reduce(function(all, subDir) {
        return [...all, [...fs.readdirSync(imgPath + '/' + subDir).map(e => subDir + '/' + e)]]
    }, []);

  folders = folders.map(e => e.slice(0,3));
  
  res.render('index', {folder: folders, img: images});
});

router.use(express.static(path.join(__dirname, 'public')));

module.exports = router;
