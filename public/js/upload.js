/**
 * @fileOverview 通用上传相关功能
 * @author wenshuo on 2015/8/25
 */

var sqlite3 = require(process.execPath + '/../node_modules/sqlite3').verbose();
var stmtAdd,stmtDelete,stmtSelect,stmtUpdate,stmtUpdateState,stmtDeleteAll,db;
(function () {
    //console.log('process.execPath:'+process.execPath + '/../data.db');

    var shell = gui.Shell;
    function openInexplorer()
    {
        shell.openExternal(clientConfig.teachBaseUrl + localStorage.orgCode);
    }

    $('.user-name').text(localStorage.name);

    var checFileUrl = clientConfig.teachBaseUrl+'api/upload/checkFile';
    var chooser = document.querySelector('#fileDialog');
    chooser.addEventListener("change", function (evt) {
        if (this.value != "") {

            var dateNow=new Date();
            var uploadfile =  evt.target.files[0];
            if(uploadfile.size>2*1024*1024*1024){
                common.promptLayer(0, '文件超过大小限制，只能上传2G以下的文件！');
                return;
            }
            uploadfile.name.replace(new RegExp("^\/"), '');
            var fileType=common.getExt(uploadfile.name);
            if(!checkFileType(fileType)){
                common.promptLayer(0, '不支持此文件格式上传！');
                return;
            }
            var resource_AttachInfo={};
            resource_AttachInfo.attachPath = localStorage.orgCode+'/'+localStorage.userCode+'/client/'+uploadfile.name;
            resource_AttachInfo.userCode= localStorage.userCode;
            resource_AttachInfo.orgCode=localStorage.orgCode;
            $.post(checFileUrl, resource_AttachInfo, function (ret) {
                if (ret.code == 0) {
                    if(ret.data==null){
                        uploadfile['id']=dateNow.getTime().toString();
                        uploadfile['createTime']=dateNow.format('yyyy-MM-dd');
                        var child = '<tr><td><img src="'+ getFileImagePath(uploadfile) +'" width="50px" height="50px">&nbsp;' + uploadfile.name.strSub(20) + '</td> <td>' + fileType + '</td> <td>' + common.formatFileSize(uploadfile.size) + '</td> <td>' + uploadfile.createTime + '</td> <td id="'+ uploadfile.id +'_state" style="text-align: center;"><span class="btn-build">正在建立上传任务</span></td> <td><span class="btn-pause" onclick="pauseUpload(\''+ uploadfile.id +'\')" id="'+ uploadfile.id +'_btn"></span><span class="btn-yundell" onclick="deleteFile(\''+ uploadfile.id +'\')" ></span></td></tr>';
                        //console.warn($('table.course-tb tr').length)
                        dataCount++;
                        console.warn(dataCount)
                        if($('table.course-tb tr').length==7){
                            $('table.course-tb tr:last').remove();
                            $(".pagination").pagination(dataCount, options);
                        }else if($('table.course-tb tr').length==0){
                            $('table.course-tb').html(tableContent);
                        }
                        $('tr.after').after(child);
                        upload(uploadfile);
                    }else{
                        common.promptLayer(0, '已有此文件名的文件！');
                    }
                }
                else {
                    common.promptLayer(0, '网络连接错误或目前无法上传，请稍后尝试');
                    console.error(ret.msg);
                }
            });
        }
    }, false);

    //var sqlite3 = require(process.execPath + '/../node_modules/sqlite3').verbose();
    var uploadsData=[];
    var pageSize= 5,
        countSql='SELECT count(*) as count FROM uploadInfo where userCode=\''+ localStorage.userCode +'\' and orgCode=\''+ localStorage.orgCode +'\'',
        sqlBase = 'SELECT * FROM uploadInfo where userCode=\''+ localStorage.userCode +'\' and orgCode=\''+ localStorage.orgCode +'\' order by ROWID desc limit ',
        //sqlExtent = options.current_page*pageSize+',' + (options.current_page+1)*pageSize,
        options = {items_per_page: pageSize, num_edge_entries: 1, current_page: 0, callback: callback};
    var dbPath='C:/Users/Public';
    var fs = require('fs');
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath);
    }
    //var db = new sqlite3.Database(dbPath + '/data.db');
    db = new sqlite3.Database('C:/Users/Public/data.db', function() {
        // prepare table...
        db.run('CREATE TABLE if not exists uploadInfo (id INTEGER ,userCode TEXT, orgCode TEXT,file TEXT,' +
            'uploadId TEXT,multipartMap TEXT,partNum INTEGER,start INTEGER,isFinish INTEGER,attachCode TEXT)', function() {
            // prepare statements...
            stmtAdd = db.prepare('INSERT INTO uploadInfo (id, userCode, orgCode, file, isFinish, attachCode)' +
                ' SELECT ?,?,?,?,0,? WHERE NOT EXISTS (SELECT 1 FROM uploadInfo WHERE id = ?)');
            stmtUpdate = db.prepare('UPDATE uploadInfo SET uploadId=?,multipartMap=?,partNum=?,start=? where id = ? ');
            stmtUpdateState = db.prepare('UPDATE uploadInfo SET isFinish=1,multipartMap=NULL,partNum=NULL,start=NULL where id = ? ');
            stmtDeleteAll = db.prepare('DELETE FROM uploadInfo');
            stmtDelete = db.prepare('DELETE FROM uploadInfo WHERE id = ?');
            stmtSelect = db.prepare('SELECT * FROM uploadInfo where id = ?');
        });

    });

    function callback(page_Index, obj) {
        if (page_Index != options.current_page) {
            options.current_page = page_Index;
            lodaData();
        }
    }

    $(function () {
        lodaData();
    });

    $('#close-button').on('mouseover',function(){
        $(this).attr('src','images/button_close_hover.png');
    });
    $('#close-button').on('mouseout',function(){
        $(this).attr('src','images/button_close.png');
    });

    $('#close-button').on('click',function(){
        window.close();
    });

    $('.btn-min').on('click',function(){
        gui.Window.get().minimize();
    });

    $('.btn-logout').on('click',function(){
        window.close();
        localStorage.isLogin='false';
        gui.Window.open('login.html',{
            "title": "云盘",
            "icon": "favicon.png",
            "toolbar": false,
            "frame": false,
            "width": 400,
            "height": 585,
            "resizable": false
        });
    });


    var tableContent='<tr class="tb-hd"> <td>文件名</td> <td>格式</td> <td>大小</td> <td>上传时间</td> ' +
        '<td width="19%">状态</td> <td>操作</td> </tr> ' +
        '<tr class="after" style="height:10px;line-height: 10px;background-color: #f9f9f9;overflow: hidden;"> <td colspan="6"></td> </tr>';
    $('table.course-tb').html(tableContent);
    var dataCount=0;
    function lodaData(){
        var index = layer.load(1);
        db.serialize(function() {
            db.get(countSql,function(err,row){
                //console.log(err);
                if(!err){
                    dataCount = row.count;
                    $('table.course-tb').html(tableContent);
                    $(".pagination").pagination(dataCount, options);
                    var sql=sqlBase + pageSize+' OFFSET ' + options.current_page*pageSize;
                    //console.log(sql);
                    db.each(sql,function(err, row) {
                        if (!err && row.id != ''){
                            var uploadInfo= uploadsData[row.id]||{};
                            uploadInfo.file=uploadInfo.file||JSON.parse(row.file);
                            var uploadfile = uploadInfo.file;
                            //var htmlstr = doT.template($('#resListTeplate').text())(uploadInfo);
                            var htmlstr='';
                            htmlstr += '<tr><td><img src="'+ getFileImagePath(uploadfile) +'" width="50px" height="50px">&nbsp;' + uploadfile.name.strSub(20) + '</td> <td>' + common.getExt(uploadfile.name) + '</td> <td>' + common.formatFileSize(uploadfile.size) + '</td> <td>' + uploadfile.createTime + '</td><td id="'+ uploadfile.id +'_state" style="text-align: center;">';
                            uploadInfo.attachCode=uploadInfo.attachCode||row.attachCode;
                            if(row.isFinish == 1){
                                htmlstr +='<span class="btn-complete"></span></td><td><span class="btn-yundell" onclick="deleteFile(\''+ uploadfile.id +'\')" ></span></td></tr>';
                            }else{
                                uploadInfo.uploadId=uploadInfo.uploadId||row.uploadId;
                                uploadInfo.multipartMap=uploadInfo.multipartMap||JSON.parse(row.multipartMap);
                                uploadInfo.partNum=uploadInfo.partNum||row.partNum;
                                uploadInfo.start=uploadInfo.start||row.start;
                                var percent=(uploadInfo.start / uploadfile.size * 100).toFixed(2) +'%';
                                htmlstr +='<div class="progress"> <div id="'+ uploadfile.id +
                                    '_progress" class="progress-bar progress-bar-warning" etype="multiple_many" role="progressbar"' +
                                    ' aria-valuenow="0" aria-valuemin="0" aria-valuemax="1" ' +
                                    'style="width:'+percent +'">' +
                                    '<span class="sr-only"></span></div> </div>';
                                htmlstr+='<span id="'+ uploadfile.id + '_progressdegree" class="btn-progressdegree">'+percent+'</span>';
                                if(uploadInfo.pause==undefined || uploadInfo.pause==true){
                                    uploadInfo.pause = true;
                                    htmlstr +='</td> <td><span class="btn-start" onclick="pauseUpload(\''+ uploadfile.id +'\')" id="'+ uploadfile.id +'_btn"></span><span class="btn-yundell" onclick="deleteFile(\''+ uploadfile.id +'\')" ></span></td></tr>';
                                }else{
                                    htmlstr +='</td> <td><span class="btn-pause" onclick="pauseUpload(\''+ uploadfile.id +'\')" id="'+ uploadfile.id +'_btn"></span><span class="btn-yundell" onclick="deleteFile(\''+ uploadfile.id +'\')" ></span></td></tr>';
                                }
                            }
                            uploadsData[row.id]=uploadsData[row.id]||uploadInfo;
                            //console.log(uploadsData[row.id]);
                            $('table.course-tb').append(htmlstr);
                        }});
                }
                layer.close(index);
            });
        });
    }

    function checkFileType(fileType) {
        var types=['mp3','mp4','rtmp','flv','txt','doc','docx','cebx','ceb','ppt','pptx','xls','xlsx','pdf','jpg','jpeg','gif','png','rar','zip','bmp','swf'];
        fileType=fileType.toLowerCase();
        if($.inArray(fileType, types)>-1){
           return true;
        }
        return false;
    }

    function getFileImagePath(file) {
        var imgTypes=['jpg','jpeg','gif','png','bmp'],
            videoTypes=['mp4','rtmp','flv'],
            musicTypes=['mp3'],
            docTypes=['doc','docx'],
            xlsTypes=['xls','xlsx'],
            pdfTypes=['pdf'],
            pptTypes=['ppt','pptx'],
            txtTypes=['txt'],
            //paperTypes=['cebx','ceb'],
            rarTypes=['rar','zip'],
            animaTypes=['swf'];
        var fileType=common.getExt(file.name).toLowerCase();
        if($.inArray(fileType, imgTypes)>-1){
            return 'images/Middle/ImgType.png';
        }
        else if($.inArray(fileType, videoTypes)>-1 || $.inArray(fileType, animaTypes)>-1){
            return 'images/Middle/VideoType.png';
        }
        else if($.inArray(fileType, musicTypes)>-1){
            return 'images/Middle/MusicType.png';
        }
        else if($.inArray(fileType, docTypes)>-1){
            return 'images/Middle/DocType.png';
        }
        else if($.inArray(fileType, xlsTypes)>-1){
            return 'images/Middle/XlsType.png';
        }
        else if($.inArray(fileType, pdfTypes)>-1){
            return 'images/Middle/PdfType.png';
        }
        else if($.inArray(fileType, pptTypes)>-1){
            return 'images/Middle/PptType.png';
        }
        else if($.inArray(fileType, txtTypes)>-1){
            return 'images/Middle/TxtType.png';
        }
        else if($.inArray(fileType, rarTypes)>-1){
            return 'images/Middle/RarType.png';
        }
        else{
            return 'images/Middle/OtherType.png';
        }
    }

    //var stmtDelete = db.prepare('DELETE FROM uploadInfo WHERE id = ?');
    var deleteurl =clientConfig.teachBaseUrl + 'api/upload/delFile';
    var ALY = require(process.execPath + '/../node_modules/aliyun-sdk');
    function deleteFile(id){
        common.promptLayer(1, '确定要删除吗？', function (i, o) {
            layer.close(i);
            stmtDelete.run(id,function (err) {
                if (err) {
                    //console.log(err);
                    common.promptLayer(0, '删除失败，请稍后重试');
                    return;
                }
                if(dataCount>pageSize && !((dataCount-1)%pageSize)){
                    options.current_page = options.current_page-1;
                }
                lodaData();
                console.log('attachCode:'+uploadsData[id].attachCode);
                $.post(deleteurl, {'attachCode':uploadsData[id].attachCode}, function (ret) {
                    if (ret.code == 0) {
                        if(ret.data==1){
                            var attachPath = localStorage.orgCode + '/' + localStorage.userCode + '/client/' + uploadsData[id].file.name;
                            if(ossConfig=={}) return;
                            var oss = new ALY.OSS(ossConfig);
                            oss.deleteObject({
                                        Bucket: clientConfig.bucket,
                                        Key: attachPath
                                    },
                                    function (err, data) {

                                        if (err) {
                                            console.log('error:', err);
                                            //return;
                                        }
                                        else console.log('success:', data);
                                    });
                        }
                    }
                    else {
                        console.error(ret.msg);
                    }
                });
            });
        }, null);
    }

    window.openInexplorer=openInexplorer;
    window.chooser=chooser;
    window.uploadsData=uploadsData;
    window.deleteFile=deleteFile;
}());