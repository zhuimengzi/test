var fs = require('fs');
var express = require('express');
var app = express();
var formidable = require('formidable');
var util = require('util');

app.use(express.static('./'));

var server = app.listen(8081, function () {

    var host = server.address().address
    var port = server.address().port

    console.log("应用实例，访问地址为 http://%s:%s", host, port)

});

app.post('/upfile', function (req, res) {
    //创建表单上传
    var form = new formidable.IncomingForm();
    //设置编辑
    form.encoding = 'utf-8';
    //设置文件存储路径
    form.uploadDir = "upload/";
    //保留后缀
    form.keepExtensions = true;
    //设置单文件大小限制
    form.maxFieldsSize = 2 * 1024 * 1024;
    //form.maxFields = 1000;  设置所以文件的大小总和

    form.parse(req, function(err, fields, files) {
        res.writeHead(200, {'content-type': 'application/json'});
        res.end(JSON.stringify({status: 'ok', fields: fields, files: files}));
    });
});
