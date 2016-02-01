/**
 * @fileOverview oss上传相关功能
 * @author wenshuo
 */

var ossConfig={};
getossConfig();
setInterval("getossConfig()",30*60*1000);
function getossConfig() {
    ossConfig={};
    $.post(clientConfig.teachBaseUrl + 'api/aly/sts', {'userCode': localStorage.userCode}, function (ret) {
        if (ret.data) {
            var credentials = ret.data.Credentials;
            ossConfig = {
                "accessKeyId": credentials.AccessKeyId,
                "secretAccessKey": credentials.AccessKeySecret,
                "securityToken": credentials.SecurityToken,
                // 注意：如果你是在 ECS 上连接 OSS，可以使用内网地址，速度快，没有带宽限制。
                endpoint: clientConfig.endpoint,
                // 这是 oss sdk 目前支持最新的 api 版本, 不需要修改
                apiVersion: '2013-10-15'
            };
            //console.log("ossConfig :", ossConfig);
        }
    });
}
(function () {
    var fs = require('fs');
    var ALY = require(process.execPath + '/../node_modules/aliyun-sdk');
    var config={
        chunkSize:4 * 64 * 1024,//2 * 64 * 1024,
        bucket:clientConfig.bucket
    };
    var BufferHelper = require(process.execPath + '/../node_modules/bufferhelper');
    //var uploadsData=[];


    function upload(file) {
        file.name.replace(new RegExp("^\/"), '');
        var id=file.id, fsize=file.size;

        if(ossConfig=={}) {
            $("#" + id + "_state").text("目前上传出现问题，请稍后尝试重新登陆继续上传");
            return;
        }
        var oss = new ALY.OSS(ossConfig);

        if(!uploadsData[id]){
            var resource_AttachInfo = {};
            resource_AttachInfo.attachPath = localStorage.orgCode+'/'+localStorage.userCode+'/client/'+file.name;
            resource_AttachInfo.attachSize = file.size;
            resource_AttachInfo.attachType = common.getExt(file.name);
            resource_AttachInfo.userCode= localStorage.userCode;
            resource_AttachInfo.orgCode=localStorage.orgCode;
            resource_AttachInfo.attachName=file.name;
            resource_AttachInfo.uploadState=0;
            resource_AttachInfo.isAliyun=1;
            //if(common.checkCebxFileType(resource_AttachInfo.attachType)){
            //    resource_AttachInfo.attachMd5=common.fileMD5(file.path);
            //    //console.log("attachMd5："+resource_AttachInfo.attachMd5);
            //}
            var crypto = require('crypto');
            var md5Sum = crypto.createHash('md5');
            var readMd5Stream = fs.createReadStream(file.path, {
                highWaterMark: 5 * 1024 * 1024,
                encoding:'utf-8'
            });
            readMd5Stream.on('data', function (chunk) {
                md5Sum.update(chunk);
            });

            readMd5Stream.on('end', function () {
                resource_AttachInfo.attachMd5= md5Sum.digest('hex');
                //console.warn('attachMd5:' + resource_AttachInfo.attachMd5);
                //console.log(file.id + '  chunkSize:' + chunkSize + ' 执行readStream结束')
                var url =clientConfig.teachBaseUrl + 'api/upload'
                $.post(url, resource_AttachInfo, function (ret) {
                    if (ret.code == 0) {
                        //console.log(ret.data);
                        uploadsData[id] = {};
                        uploadsData[id].attachCode = ret.data.attachCode;
                        uploadInit();
                    }
                    else {
                        console.error(ret.msg);
                    }
                });
            });
        }else{
            //console.log('attachCode:'+uploadsData[id].attachCode);
            uploadInit();
        }


        function uploadInit() {
            uploadsData[id].file = uploadsData[id].file || {
                    size: fsize,
                    name: file.name,
                    path: file.path,
                    type: file.type,
                    id: id,
                    createTime: file.createTime
                };
            uploadsData[id].pause = false;

            stmtAdd.run(id, localStorage.userCode, localStorage.orgCode, JSON.stringify(uploadsData[id].file),
                uploadsData[id].attachCode, id,
                function (err) {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    var chunkSize = config.chunkSize;
                    var attachPath = localStorage.orgCode + '/' + localStorage.userCode + '/client/' + file.name;
                    var uploadId = uploadsData[id].uploadId || '';
                    var maxUploadTries = 3;
                    var result = {};
                    var multipartMap = uploadsData[id].multipartMap || {
                            Parts: []
                        };

                    var callback = function (err, res) {
                        if (err) {
                            console.error(err);
                            $("#" + id + "_state").text("上传出现问题，稍后请重新尝试继续上传");
                            uploadsData[id].pause=true;
                            $("#"+id+"_btn").attr('class','btn-start');
                            return;
                        }
                        stmtUpdateState.run(id, function (err) {
                            if (err) {
                                console.error(err);
                            }else{
                                var url =clientConfig.teachBaseUrl + 'api/upload/uploadState';
                                $.post(url, {'attachCode':uploadsData[id].attachCode,'uploadState':1}, function (ret) {
                                    if (ret.code == 0) {
                                        //console.log(ret.data);
                                    }
                                    else {
                                        console.error(ret.msg);
                                    }
                                });
                            }
                        });
                        $("#" + id + "_state").css({"textAlign":"center"}).html('<span class="btn-complete"></span>');
                        $("#" + id + "_btn").hide();
                    };

                    if (fsize > chunkSize) {
                        if (uploadId == '') {
                            var params = {
                                //ACL: 'public-read',
                                Bucket: config.bucket,
                                Key: attachPath,
                                ContentType: file.type || ''
                            };
                            oss.createMultipartUpload(params,
                                function (mpErr, res) {
                                    if (mpErr) {
                                        callback(mpErr);
                                    }

                                    //console.log("Got upload ID", res.UploadId);
                                    uploadId = res.UploadId;
                                    uploadsData[id].uploadId = uploadId;
                                    uploadMultipart(callback);
                                });
                        } else {
                            uploadMultipart(callback);
                        }
                    }
                    else {
                        uploadSingle(callback);
                    }

                    function uploadMultipart(callback) {
                        result.partNum = uploadsData[id].partNum || 0;
                        if (result.partNum > 0) {
                            result.partNum += 1;
                        }
                        result.start = uploadsData[id].start || 0;
                        var readStream = fs.createReadStream(file.path, {
                            highWaterMark: chunkSize,
                            start: result.start,
                            end: fsize
                        });
                        //console.log(file.id + ' start:' + result.start + ',end:' + fsize + ',chunkSize:' + chunkSize);
                        var bufferHelper = new BufferHelper();

                        readStream.on('data', function (chunk) {
                            if (chunk.length < chunkSize && chunk.length + result.start + bufferHelper.toBuffer().length < fsize) {
                                //console.warn(file.id + ' chunk变小：' + chunk.length);
                                bufferHelper.concat(chunk);
                            }
                            else {
                                bufferHelper.concat(chunk);
                                var temp = bufferHelper.toBuffer();
                                bufferHelper.empty();
                                result.chunk = temp;
                                result.start += temp.length;
                                //console.log(file.id + ' chunk ' + (result.partNum + 1) + '的大小：' + temp.length);
                                if (result.start < fsize) {
                                    readStream.pause();
                                }
                                uploadPart(result, callback);
                            }

                        });

                        //readStream.on('end', function () {
                        //    console.log(file.id + '  chunkSize:' + chunkSize + ' 执行readStream结束')
                        //});

                        readStream.on('error', function () {
                            console.error("读取文件失败");

                        });

                        function uploadPart(result, callback) {

                            var partNum = result.partNum;
                            var partParams = {
                                Body: result.chunk,
                                Bucket: config.bucket,
                                Key: attachPath,
                                PartNumber: String(partNum + 1),
                                UploadId: uploadId
                            };

                            var tryNum = 1;

                            var doUpload = function () {
                                oss.uploadPart(partParams, function (multiErr, mData) {
                                    if (multiErr) {
                                        //console.log('multiErr, upload part error:', multiErr);
                                        if (tryNum > maxUploadTries) {
                                            console.warn(file.id + ' 上传分片失败: #', partParams.PartNumber);
                                            callback(multiErr);
                                        }
                                        else {
                                            console.warn(file.id + ' 重新上传分片: #', partParams.PartNumber);
                                            tryNum++;
                                            doUpload();
                                        }
                                        return;
                                    }
                                    // console.log(mData);

                                    multipartMap.Parts[partNum] = {
                                        ETag: mData.ETag,
                                        PartNumber: partNum + 1
                                    };
                                    //console.log(file.id + " Completed part", partNum + 1);
                                    var percent = (result.start / fsize * 100).toFixed(2) + '%';
                                    if(partNum==0){
                                        $("#" + id + "_state").html('<div class="progress"> <div id="'+ file.id +
                                            '_progress" class="progress-bar progress-bar-warning" etype="multiple_many" ' +
                                            'role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="1"' +
                                            ' style="width:'+ percent +'"><span class="sr-only"></span></div> </div>' +
                                            '<span id="'+ file.id + '_progressdegree" class="btn-progressdegree">'+percent+'</span>');
                                    }else{
                                        $("#" + id + "_progress").attr('style','width:'+ percent +'%');
                                        $("#" + id + "_progressdegree").text(percent);
                                    }
                                    //console.log('mData', mData);
                                    uploadsData[id].start = result.start;
                                    uploadsData[id].partNum = result.partNum;
                                    uploadsData[id].multipartMap = multipartMap;
                                    if (uploadsData[id].pause && uploadsData[id].start < fsize) {
                                        //console.warn(file.id + ' 暂停');
                                        stmtUpdate.run(uploadsData[id].uploadId, JSON.stringify(multipartMap),
                                            result.partNum, result.start, id, function (err) {
                                                if (err) {
                                                    console.error(err);
                                                }
                                            });
                                        return;
                                    }
                                    if (result.start == fsize) {
                                        completePart(callback);
                                        return;
                                    } else {
                                        stmtUpdate.run(uploadsData[id].uploadId, JSON.stringify(multipartMap), result.partNum,
                                            result.start, id, function (err) {
                                                if (err) {
                                                    //console.log(err);
                                                    callback(err);
                                                    return;
                                                }
                                                result.partNum++;
                                                readStream.resume();
                                            });

                                    }
                                });
                            };

                            doUpload();

                        };

                        function completePart(callback) {
                            //console.log(file.id + " completePart");
                            var doneParams = {
                                Bucket: config.bucket,
                                Key: attachPath,
                                CompleteMultipartUpload: multipartMap,
                                UploadId: uploadId
                            };

                            oss.completeMultipartUpload(doneParams, callback);
                        };
                    };

                    function uploadSingle(callback) {
                        var buffer = fs.readFileSync(file.path);
                        var params = {
                            //ACL: 'public-read',
                            Bucket: config.bucket,
                            Key: attachPath,
                            Body: buffer,
                            ContentType: file.type || ''
                        };
                        oss.putObject(params, callback);
                    };
                });
        }
    }

    function pauseUpload(id){
        if(uploadsData[id].pause){
            $("#"+id+"_btn").attr('class','btn-pause');
            upload(uploadsData[id].file);
        }else{
            uploadsData[id].pause=true;
            $("#"+id+"_btn").attr('class','btn-start');
        }
    }


    window.upload = upload;
    window.pauseUpload=pauseUpload;

})();
