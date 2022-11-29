(function(){

    function Radish(vastClient, fpApi, config){

        this.shownCnt = 0; // Счётчик показов объявлений
        this.allowReplay = false; //Разрешаем повтор только если объявление запустилось
        this.isReplay = false; //Разрешаем повтор только если объявление запустилось
        this.state = 0; //0, 1, 2, 3, 4, 5, 6;
                           // 0 - Начальное состояние.
                           // 1 - DOM нарисован, события навешаны, данные получены
                           // 2 - хз
                           // 3 - готов к запуску. 
                           // 4 - плеер показан (реклама запущен или идёт перебор).
                           // 5 - реклама показывается.
                           // 6 - показ ролика завершён успешно
        this.data = {};
        this.isStarted = false;

        this.html = {};
        this.ui;
        this.active = {};


        var self = this;
        var dispatch = cEventDispatcher(this); 
        console.log(dispatch);


        if(!config.template) config.template = {}; // Шаблон для кнопки пропуска.


        this.init = function(){

            // Генерируем дом
            var html = this.html = new CreateHtml(config.wrapper, config.template);
            var ui = this.ui = html.create();
            this.adsArr = [];

            
            ui.close.add(ui.skip).on("click", function(e){
                if(ui.skipWrap.hasClass("active")) self.end();
                return false;
            });
            ui.vol.on("click", function(e){
                var video = self.active.data.api.video;
                self.mute(video, "toggle");
                return false;
            });
            this.load(config.url);
        }

        this.load = function(url){  // Перебирает все коды, и создаёт для каждого из них разметку

            //Опрашиваем все коды и получаем васты. Результат записываем в массив, добавив для каждого кода опции показа

            vastClient.get(url, {
                resolveAll: false,
                allowMultipleAds: true
            }).then(function(res){
                ///createAd();
                //console.log("Объявление № 0");
                //Первый код обрабатываем отдельно от остальных из-за особенностей работы васт-клиента.
                console.log(vastClient.vastParser);
                var remaingAds = vastClient.vastParser.remainingAds.slice();
                if(res.ads.length){
                    self.adsArr[0] = {
                        iOpts: {
                            index: 0,
                            url: vastClient.vastParser.parentURLs[vastClient.vastParser.parentURLs.length-1],
                        },
                        ads: res.ads,
                        item: {},
                        slots: []
                    };
                    var arrItem = self.adsArr[0];
                    workWithResponse(arrItem);
                    loadAd(arrItem, 0);
                };


                var adsCnt = 0, adsTotal;
                for(let i=1; ; i++){
                    let url;
                    if(i<=remaingAds.length) url = remaingAds[i-1][0].nextWrapperURL;
                    if(vastClient.hasRemainingAds()){
                        vastClient.getNextAds().then(function(res){
                            if(res.ads.length){
                                self.adsArr[i] = {
                                    iOpts: {
                                        index: i,
                                        url: url,
                                    },
                                    ads: res.ads,
                                    item: {},
                                    slots: []
                                };
                                var arrItem = self.adsArr[i];
                                workWithResponse(arrItem);
                                loadAd(arrItem, 0);
                            };

                            //Проверяем все ли коды были обработаны
                            checkCreated(++adsCnt, adsTotal);

                        }).catch(function(err){
                            checkCreated(++adsCnt, adsTotal);
                            console.log(err);
                        });
                    }else{
                        adsTotal = i;
                        checkCreated(adsCnt, adsTotal);
                        break;
                    }
                };
            });
        };

        this.start = function(){
            self.isStarted = true;
            config.autostart = true;

            var $firstItem = this.ui.wrap.find(".v-player__item").eq(0);
            if(!$firstItem[0].data.adready){
                self.waitTime.start($firstItem[0].data.waitTime);
            }else{
                $(config.wrapper + " .waitTime").text($firstItem[0].data.waitTime);
            }
            if($firstItem.hasClass("ready")){
            	self.play($firstItem);
            }else{
                console.log("Добавляем слушатель update");
                self.addCustomEvent("update", checkState);
                console.warn("Креатив ещё не подгрузился");
            }
            if(!config.showAfterStart) self.html.wrap.addClass("active");
            function checkState(){
                console.log("checkState");
                console.log("Удаляем слушатель update");
                self.removeCustomEvent("update", checkState);
                self.start();
            }
        };
        this.play = function($item){
            var $firstSlot = $item.children(".v-player__slot").eq(0),
                itemData = $item[0].data,
                slotData = $firstSlot[0].data;
            $firstSlot.addClass("active");
            if(slotData.type == "vast"){
                slotData.api.video.play();
                self.ui.wrap.addClass("vast_active");
                console.log(slotData);
                skipTimer.start(slotData);
                startedShow();
                console.log("Васт показался, пишем в стату");
            }else{
                self.ui.wrap.addClass("vpaid_active");
                slotData.api.vpaid.startAd();
            };

        };
        this.replay = function () {
            console.log("REPLAY");
            var replayVast = new VAST.VASTClient();
            var itemData = self.active.item.data;
            var vastUrl = itemData.url;
            itemData.isShowed = false;
            replayVast.get(vastUrl, {
                resolveAll: true,
                allowMultipleAds: true
            }).then(res => {
                if(!res.ads.length){
                    console.error("replay error", "Нет доступных объвлений");
                }else{
                    var idx = itemData.index;
                    console.log(self.adsArr[idx].iOpts);
                    self.adsArr[idx].ads = res.ads;
                    var arrItem = self.adsArr[idx];
                    workWithResponse(arrItem);
                    loadAd(arrItem, 0);
                }
            }).catch(err => {
                console.log(err);
                throw "replay error "+err;
            });
            return;
        };


        this.update = function(){

        };



        //Удаляет item
        this.end = function($item){
            dispatch("ended", $item);
        	var isFirst = false;
        	if($item) isFirst = $item.is(":first-child");
            if(!$item || isFirst){
                if(!$item) $item = self.ui.wrap.find(".v-player__item").eq(0);
                var itemOpts = $item[0].data;
                var arrItem = self.adsArr[itemOpts.index];
                if(self.shownCnt == 0){
                    $item.remove();
                    self.ui.wrap.removeClass("vast_active vpaid_active");
                    codeList.update(); //временно
                    dispatch("update");
                    if(!self.ui.wrap.find(".v-player__item").length) self.destroy();
                    else self.start();
                    return;
                };
                if(config.maxAds > self.shownCnt){
                    if(itemOpts.replay && itemOpts.isShowed){
                        arrItem.iOpts.replay--;
                        $item.remove();
                        self.ui.wrap.removeClass("vast_active vpaid_active");
                        codeList.update(); //временно
                        dispatch("update");
                        self.replay();
                        return;
                    }else if(itemOpts.showNext == "yes"){
                        $item.remove();
                        codeList.update(); //временно
                        dispatch("update");
                        self.ui.wrap.removeClass("vast_active vpaid_active");
                        if(self.ui.wrap.find(".v-player__item").length) self.start();
                        else self.destroy();
                    }else{
                        self.destroy();
                    }
                }else{
                    self.destroy();
                }
            }else{
                $item.remove();
            }
            console.log(self.shownCnt);


            /*

                 при завершении 
                 удаляем текущий item, 
                 смотрим параметр текущего кода

                 replay у item и maxAds у config. Если replay включен и показанных объявлений меньше чем maxAds, 
                 то получаем url xml васта, создаём новый item из полученных данных, 
                 и делаем инициализацию.

                 Если replay отключен, то проверяем параметр showNext у item и maxAds у config. 
                 Если showNext включен и показанных объявлений меньше чем maxAds, то переходим к следующему item.




            */  
        };

        //завершаем работу плеера, коды закончились или необходимое кол-во рекламы показалось
        this.destroy = function(){
            $(config.wrapper).remove();
            $(".partners-wrapper").remove(); //временно
            console.log("[DESTROY] DESTROY");
            console.log("Удаляем васт плеер, завершаем его работу и больше не планируем его использовать!");
            /*
            //Если получили у впаида stopped или error
            //Это значит что объявление не подобралось 
            //или закончилось или было пропущено.

            if(self.timeout.time <= 0){
                stopVastPlayer();
                return;
            };
            
            if(opts.maxAds > self.allCnt){ //Проверяем надо ли ещё показывать объявления

                resetVastPlayer();
                if(self.allCnt === 0){
                    console.log("Объявление ещё не показано, проверяем следующее");
                    self.getNext();
                    return;
                }else if(self.isNext){
                    console.log("Предыдущее объявление показано, и у него включена опция ShowNext, проверяем следующее");
                    opts.bgLoading = true;
                    self.getNext();
                    return;
                }else if(self.allowReplay && opts.ext.Replay && opts.ext.Replay >= vastRoll.replayCnt+1){
                    console.log("Объявление показано, включена опция Replay, запускаем повтор");
                    opts.bgLoading = true;
                    self.replay();
                    return;
                }else if(opts.ext.ShowNext){
                    console.log("Объявление показано, включена опция ShowNext, проверяем следующее");
                    self.isNext = false;
                    console.log(opts.skipNextAds);
                    opts.bgLoading = true;
                    if(opts.skipNextAds){
                        self.getNext(true); 
                    }else{
                        self.getNext();
                    }
                    return;
                };



                hideVastPlayer();

            }else{
                stopVastPlayer();
            };

            function resetVastPlayer(){
                skipTimer.stop();  //Сбрасываем скип-таймер
                $(opts.wrapper).removeClass("is-vpaid").empty(); //Очищаем контейнер впаида
                self.vpaid.state = false; // Впаид не загружен


                //Сбрасываем состояние отправки стартовых событий
                startEvents.state = false;
            };
            function hideVastPlayer(){
                $(opts.wrapper).removeClass("active");
                // #запускаем фильм.
                self.state = 0;
                self.api.play();
                self.state = 6;
                console.log("Завершаем показ");
            };
            function stopVastPlayer(){
                resetVastPlayer();
                hideVastPlayer();
            };
            */
        }

        this.convertTime = function(time) {
            console.log(time);
            var duration_sec = self.api.video.duration;
            var pro = ((time-duration_sec)/duration_sec) * 100;
            var jo = 100 + pro;
            return jo;
        }

        var skipTimer = {
            timer: false,
            start: function(slotData){
                var skipDelay = slotData.skipDelay,
                    time = +skipDelay-1,
                    ui = self.ui;

                ui.skipWrap.removeClass("active");
                clearInterval(this.timer);



                this.timer = setInterval(function () {
                    if (time <= 0) {
                        ui.skipTime.text(config.skipDelay);
                        clearInterval(this.timer);
                        ui.skipWrap.addClass("active");
                    } else {
                        let strTimer = time;
                        ui.skipTime.text(strTimer);
                    }
                    --time;
                }, 1000)
            },
            stop: function(){
                clearInterval(this.timer);
            }
        };

        this.timeout = {
            timer: null,
            time: Number(config.timeout),
            start: function(){
                if(this.timer === null){
                    let _self = this;
                    this.timer = setInterval(function () {
                        if (_self.time <= 0) {
                            clearInterval(_self.timer);
                            if(self.waitTime.timer){
                                clearInterval(self.waitTime.timer);
                            };
                            console.log("Закрытие по таймауту");
                            //Останавливаем работу васт-плеера и запускаем фильм
                        }
                        --_self.time;
                    }, 1000);
                }
            },
            stop: function(){
                console.log("timeout timer stop");
                clearInterval(this.timer);
                this.timer = false; // false = как минимум один показ рекламы был

            }
        };
        this.waitTime = {
            timer: false,
            start: function(time){
                console.log(time);
            	if(config.showAfterStart) time = 30;
                clearInterval(this.timer);
                console.log("Запускаем waitTimer");
                $(config.wrapper +" .waitTime").text(time)// Временно
                let _self = this;
                time = +time;
                console.log(time);
                this.timer = setInterval(function () {
                    $(config.wrapper +" .waitTime").text(time)// Временно
                    if (time <= 0) {
                        clearInterval(_self.timer);
                        console.log("Время ожидания вышло, переходим к следующему коду");
                        this.stop();
                        self.end();
                    };
                    --time;
                }, 1000);
            },
            stop: function(){
                console.log("waitTimer stop");
                clearInterval(this.timer);
                this.timer = false;

            }
        };
        this.next = function(){
            self.end();

            self.start();
        };

        this.mute = function(video, flag){
            if(flag === "toggle"){
                if(video.muted){
                    self.ui.vol.removeClass("muted");
                    $(video).prop("muted", false);
                }else{
                    self.ui.vol.addClass("muted");
                    $(video).prop("muted", "muted");
                }
            }else if(flag == true){
                $(video).prop("muted", "muted");
                $(video).prop("muted", "muted");
            }else{
                $(this).removeClass("muted");
                $(video).prop("muted", false);
            };
        };

        function startedShow(){
        	console.log("startedShow");

            if(config.showAfterStart) self.html.wrap.addClass("active");

            var $firstItem = self.ui.wrap.find(".v-player__item").eq(0),
                $firstSlot = $firstItem.children(".v-player__slot").eq(0),
                itemData = $firstItem[0].data,
                slotData = $firstSlot[0].data;

            itemData.isShowed = true;
            self.active.item = $firstItem[0];
            self.active.slot = $firstSlot[0];
            self.active.data = slotData;
            self.waitTime.stop();
            self.active.allowReplay = true;
            self.shownCnt++;
        };

        function addExt(arrItem){
            if(arrItem.ads[0].extensions && arrItem.ads[0].extensions.length){
                var exts = arrItem.ads[0].extensions[0].children;
                exts.forEach(function(item){
                    if(item.name !== "#text"){
                        var s = item.name[0].toLowerCase() + item.name.slice(1);
                        arrItem.iOpts[s] = item.value;
                    };
                });
            }else{
                console.warn("Item Extensions not found");
            };
        };
        function workWithResponse(arrItem){
            addExt(arrItem);
            for(var i=0; i<arrItem.ads.length; i++){
                //Создаём разметку
                var htmlItem = self.html.addSlot(arrItem.iOpts.index);
                arrItem.slots[i] = htmlItem.slot;

                if(i==0) arrItem.item = htmlItem.item;
            };
            //Прикрепляем данные для отдельного кода к DOM объекту "item"
            arrItem.item[0].data = {};
            for(key in arrItem.iOpts){
                arrItem.item[0].data[key] = arrItem.iOpts[key];
            };
            console.log("Данные прикрепленны");
            arrItem.item.attr("data-name", arrItem.item[0].data.systemName); //временно
            arrItem.item.append("<div class='waitTime'>"+arrItem.item[0].data.waitTime+"</div>") //временно;
        };


        function loadAd(arrItem, index){
            try{
                var ad = arrItem.ads[index],
                    $item = arrItem.item,
                    $slot = arrItem.slots[index],
                    args = arguments,
                    ui = self.ui;
                var creatives = ad.creatives,
                    mediaFiles,
                    linearCr,
                    slotOpts = $slot[0].data = {},
                    itemOpts = $item[0].data;
                    slotOpts.api = {};

                slotOpts.index = index;
                slotOpts.api.video = $slot.video[0];



                //Вначале проверяем есть ли линейный креатив
                var isLinear = creatives.some(function(item, i, arr) {
                    if(item.type === "linear"){
                        linearCr = item;
                        return true;
                    };
                });

                if(isLinear){
                    mediaFiles = linearCr.mediaFiles;

                    //Прикрепляем данные для отдельного ad к DOM объекту "slot"
                    if(linearCr.duration) slotOpts.duration = linearCr.duration;

                    //# Добавить возможность установки времени пропуска из опций или из аттрибута тега linear
                    var skipDelay = config.skipDelay;
                    linearCr.duration < skipDelay ? slotOpts.skipDelay = linearCr.duration : slotOpts.skipDelay = skipDelay;


                    //self.tracker = new VAST.VASTTracker(vastClient, ad, linearCr);




                    //Делаем проверку на интерактивную рекламу
                    var vpaidMedia;

                    mediaFiles.some(function(item, i, arr) {
                        if(item.apiFramework === "VPAID" && item.mimeType == "application/javascript"){
                            vpaidMedia = item;
                            return true;
                        };
                    });
                    if(vpaidMedia){
                        try{
                            slotOpts.type = "vpaid";
                            var vpaid = new Vpaid(linearCr, vpaidMedia, ad, $item, $slot, self);


                            vpaid.addCustomEvent("loaded", function(e){
                                console.log("СustomEvent LOADED");
                                $item.addClass("ready");

                                // Проверяем нужен ли автостарт. Далее
                                // Если загруженный Ad является первым item и первый slot, 
                                // то запускаем его
                                dispatch("update", $slot);
                                if(config.autostart && $item.is(":first-child") && $slot.is(":first-child")){
                                    self.start()
                                };
                            });


                            vpaid.addCustomEvent("vpaidEnd", function(){
                                beforeEnd();
                            });
                            vpaid.addCustomEvent("started", function($item){
                                startedShow();
                            })

                        }catch(e){
                            //Если во время последующей обработки возникает ошибка,
                            //то переходим к следующему объявлению
                            console.log("[RADISH.load] - возникла ошибка при инициализации объвяления в "+itemOpts.systemName+". Тип - VPAID");
                            console.warn(e);
                            //this.nextAd();
                        }
                    }else{
                        try{
                            slotOpts.type = "vast";

                            ui.skipTime.text(config.skipDelay);

                            var mediaFile = selectMedia(mediaFiles),
                                url = mediaFile.fileURL;
                            $slot.video.attr("src", url);

                            $item.addClass("ready");

                            if($item.is(":first-child") && config.autostart) self.start();

                            $slot.video[0].addEventListener("ended", function(){
                                beforeEnd();
                            });
                            
                            dispatch("update", $slot);
                        }catch(e){
                            //Если во время последующей обработки возникает ошибка,
                            //то переходим к следующему ads
                            console.log("[RADISH.load] - возникла ошибка при инициализации объвяления в "+itemOpts.systemName+". Тип - VAST");
                            console.warn(e);
                            //this.nextAd();
                        }
                    };
                    function beforeEnd(){
                        $slot.remove();
                        codeList.update(); //временно
                        if($item.is(":first-child") && self.shownCnt > 0){
                            self.end($item);
                        }else{
                            if(arrItem.ads.length > index+1) loadAd(args[0], ++args[1]);
                            else self.end($item);
                        }
                    }
                }else{
                    //Если нету, то переходим к следующему ads
                    console.log("[RADISH.load] - в "+itemOpts.systemName + " не найдено линейных объявлений");
                    vast.next();
                };


                function selectMedia(mediaFiles){
                    var mediaFile;
                    for(let i = 0; mediaFiles.length > i; i++){
                        let bitrate = mediaFiles[i].bitrate;
                        if(mediaFiles[i].mimeType == config.mimeType && bitrate >= config.bitrateMin && bitrate <= config.bitrateMax){
                            mediaFile = mediaFiles[i];
                            break;
                        };
                    };
                    //Если не один из файлов не подошел под желаемые параметры, 
                    //то пытаемся запустить первый в списке
                    if(!mediaFile){
                        mediaFile = mediaFiles[0];
                    };
                    return mediaFile;
                };
            }catch(e){
                console.error("loadAd error", e)
                if(arrItem.ads.length > index+1){
                    loadAd(args[0], ++args[1]);
                }
            }
        };

        function checkCreated(c, t){
            console.log(c, t);
            if(c+1 == t){
                console.log(self.adsArr);
                self.state = 1;
                dispatch("created", self);
            };
        };
        /*
        function afterEndCheck($item){
            console.log(config.shownCnt);
            console.log(config.maxAds);
            var slotData = $slot[0].data;
            console.log(slotData);
            var replay = slotData;
            var bShowNext = slotData;
        };
        */

    };


    function CreateHtml(wrapper, template){
        var templateUI, templateSlot;
        this.create = function(){
            console.log("CreateHtml");
            var $rollWrap = this.wrap = $(wrapper);
            if($rollWrap.find(".v-player").length){
                console.warn("[CREATE_HTML] - Контейнер уже создан");
                return;
            };

            templateUI = {
                wrap: $("<div class='v-player' />"),
                vastSlots: $("<div class='v-slots' />"),
                skipWrap: $("<div class='v-player__skip-wrap' />"),
                close: $("<div class='v-player__close' />"),
                vol: $("<div class='v-player__vol' />"),
                skip: $("<div class='v-player__skip' />"),
                skipBefore: $("<div class='v-player__skip-before' />"),
                skipTime: $("<div />", {
                    class: "v-player__time",
                }),
                skipAfter: $("<div />", {
                    class: "v-player__skip-after",
                    text: "Пропустить"
                }),

                nav: $("<div />", {
                    class: "v-player__pagin",
                    text: "Реклама "
                }),
                navCurrent: $("<div />", {
                    class: "v-player__current-page",
                    text: ""
                }),
                navAmount: $("<div />", {
                    class: "v-player__pages",
                    text: ""
                }),
            };

            templateSlot = {
                divWrap: "<div class='v-player__item' />",
                divSlot: "<iframe class='v-player__slot' />",
                video: "<video class='v-player__video' preload='auto' playsinline='true' webkit-playsinline='true' type='video/mp4' x-webkit-airplay='allow' />",
                iframe: "<iframe class='v-player__iframe' allow='autoplay' scrolling='no' allowFullscreen=''/>",
            }

            var skipTPre, skipTPost;
            if(templateUI.skipText){
                skipTPre = templateUI.skipText.pre ? templateUI.skipText.pre : "Пропустить через";
                skipTPost = templateUI.skipText.post ? templateUI.skipText.post : "сек";
            }else{
                skipTPre = "Пропустить через";
                skipTPost = "сек";
            }

            var skipPre = $("<div />", {
                    class:"v-player__pre",
                    text: skipTPre
                }),
                skipPost = $("<div />", {
                    class: "v-player__post",
                    text: skipTPost
                });


            var preloader = $("<div />", {
                    class: "v-player__loader fp-preloader",
                });

            templateUI.preloader ? preloader.append(templateUI.preloader) : preloader.append("<div class='lds-dual-ring'></div>");

            templateUI.nav.append(templateUI.navCurrent, templateUI.navAmount);

            templateUI.wrap.on("click", function(){
                return false;
            });


            templateUI.wrap.append(templateUI.vastSlots, preloader);

            templateUI.skipBefore.append(skipPre, templateUI.skipTime, skipPost);
            templateUI.skip.append(templateUI.skipBefore, templateUI.skipAfter);

            templateUI.skipWrap.append(templateUI.close, templateUI.skip);
            templateUI.wrap.append(templateUI.video, templateUI.vol, templateUI.skipWrap, templateUI.vpaid, templateUI.nav);

            $rollWrap.append(templateUI.wrap);

            return templateUI;
            /*
            self.video.addEventListener('pause', function(){
                //***Отправляем событие паузы
            });
            self.video.addEventListener('resume', function(){
                //***Отправляем событие resume
            });

            self.video.addEventListener('click', function(){
                //***Отправляем событие клика
                //self.creative.videoClickTrackingURLTemplates[0].url

                window.open(self.creative.videoClickThroughURLTemplate.url);
            });

            self.video.addEventListener("ended", function(){
                if(!(self.type === "vpaid")) self.end();
            });

            if(self.state !== 2){
                self.state = 1;
            }
            */

        };     

        this.addSlot = function(index){
            console.log("[CREATE_HTML].addSlot");

            //postfix - 0, undefined, number, string





            var $item,
                itemClass = "v-player__item";

            var $slot = $(templateSlot.divSlot),
                $iframe = $(templateSlot.iframe),
                $video = $(templateSlot.video);

            $iframe.add($slot).attr({
                "allow": "autoplay",
                "scrolling": "no",
                "allowFullScreen": "",
            });
            $iframe.css({
                "position": "absolute",
                "top": "0",
                "left": "0",
                "width": "100%",
                "height": "100%",
                "border": 0,
                "z-index": "999"
            });

            $video.attr({
                'preload': 'auto',
                'x-webkit-airplay': 'allow',
                'webkit-playsinline': 'true',
                'cursor': 'pointer',
                'playsinline': '1',
                'src': '//webcod.pro/v/v2.mp4',
            });
            $video.css({
                "position": "relative",
                "width": "100%",
                "height": "100%",
                "object-fit": "contain",
                "min-height": "auto",
                "max-height": "none",
                "min-width": "auto",
                "max-width": "none",
                "z-index": "998"
            });


            if(index !== undefined && $(wrapper +" ."+itemClass+"[data-index="+index+"]").length){
                $item = $(wrapper +" ."+itemClass+"[data-index="+index+"]");
                $item.attr("data-index", index).append($slot);
            }else{
                $item = $("<div />", {
                    class: itemClass
                });
                $item.attr("data-index", index).append($slot);

                if(templateUI.vastSlots.children().length){
                    templateUI.vastSlots.prepend($item);
                    templateUI.vastSlots.children().each(function(){
                        if($(this).data("index") < index){
                            $(this).after($item);
                        };
                    });
                }else{
                    templateUI.vastSlots.append($item);
                };
            };

            var dT = "<!DOCTYPE html><head><meta charset='UTF-8'></head><body style='margin:0;padding:0'></body></html>",
                content = $slot[0].contentWindow.document;
            content.open();
            content.write(dT);
            content.close();
            var $slotBody = $slot.contents().find("body");


            $slotBody.append($iframe, $video);

            $slot.iframe = $iframe;
            $slot.video = $video;

            return {
                item: $item,
                slot: $slot,
            };
        };

        var x = {index: 1};
        x.y = {index: 2}

        this.clean = function(){
            //удаляем все васт-слоты в текущем враппе
        }
        this.destroy = function(){
            //удаляем текущий врап со всеми элементами
        }
    }


    function Vpaid(creative, media, ad, $item, $slot, radishApi){
        var vpaidDispatch = cEventDispatcher(this),
            itemOpts = $item[0].data,
            slotOpts = $slot[0].data;


        var iframe = $slot.iframe,
            iframeContent = iframe[0].contentWindow.document;

        console.log(media);
        var file = media.fileURL;
        var state = "";
        var adId = itemOpts.index+""+slotOpts.index;


        var adParam = creative.adParameters;


        var dT = "<!DOCTYPE html><head><meta charset='UTF-8'></head><body style='margin:0;padding:0'><script src='" + file + "'></script><script>window.parent.postMessage('V_PLAYER_LOADED','*');</script></body></html>";

        setTimeout(function(){
            iframeContent.open();
            iframeContent.write(dT);
            iframeContent.close();
        }, 0);


        $($slot[0].contentWindow).on("message", waitVpaid);

        function waitVpaid(e){
            if (e.originalEvent.data == "V_PLAYER_LOADED") {
              $(window).off("message."+"ind"+adId);
              initVpaid();
            };
        };



        function initVpaid() {
            try{
                var fn = iframe[0].contentWindow['getVPAIDAd'];
                if(fn && typeof fn == 'function') {
                    var vpaidApi = slotOpts.api.vpaid = fn();

                    if (typeof vpaidApi.handshakeVersion == "function") {
                        for (var eventName in vpaidCallbacks) {
                            if (vpaidCallbacks.hasOwnProperty(eventName)) {
                                vpaidApi.subscribe(vpaidCallbacks[eventName], eventName, this)
                            };
                        }

                        let vpaidSlot = $("<div />").css({
                            position: "absolute",
                            top: "0",
                            left: "0",
                            width: "100%",
                            height: "100%",
                            zIndex: "999",
                            color: "white",
                        });


                        iframe.contents().find("body").append(vpaidSlot);

                        console.log("VPAID initAd");
                        vpaidApi.initAd("100%", "100%", 'fullscreen', 720,  {"AdParameters": adParam}, {
                            "slot": vpaidSlot[0],
                            "videoSlot": $slot.video[0],
                            'videoSlotCanAutoPlay': true
                        });
                    } else {
                        console.log("VPAID incorrect");
                    }

                } else {
                    console.error("initVpaid error2");
                    //# Если в подключенном впаиде нету нужной функции, то прекращаем выполнение текущего впаида
                    //  и переходим к следующему коду
                }
            }catch(e){
                console.error(e);
                vpaidDispatch("error", e);
            }
        };

        //#Вставляем видео-заглушку и запускаем

        var cbFns = {
            vpaidStartAd: function(){
                console.log("AdStarted", $item[0].data.systemName);
            },
            vpaidStopAd: function(e){
                console.log("stopAd", $item[0].data.systemName);
                vpaidDispatch("vpaidEnd", $item);
            },
            vpaidSkipAd: function(){
                console.log("AdSkipped", $item[0].data.systemName);
            },
            vpaidAdLoaded: function(e){
                console.log("vpaidAdLoaded", $item[0].data.systemName);
                vpaidDispatch("loaded", e);
                
            },
            vpaidAdError: function(e){
                console.log("AdError", e, $item[0].data.systemName);
                vpaidDispatch("vpaidEnd", $item);
                //self.rotator.nextAd();
            },
            vpaidAdImpression: function(){
                console.log("AdImpression", $item[0].data.systemName);
                vpaidStartActions();
            },
            vpaidAdLinearChange: function(){
                console.log("AdLinearChange");
            },
            vpaidAdSizeChange: function(){
                console.log("AdSizeChange");
            },
            vpaidAdExpandedChange: function(){
                console.log("AdExpandedChange");
            },
            vpaidAdSkippableStateChange: function(){
                console.log("AdSkippableStateChange");
            },
            vpaidAdDurationChange: function(){
                console.log("AdDurationChange");
            },
            vpaidAdRemainingTimeChange: function(){
            },
            vpaidAdVolumeChange: function(){
            },
            vpaidAdClickThru: function(){
                console.log("AdClickThru");
            },
            vpaidAdInteraction: function(){
                console.log("AdInteraction");
            },
            vpaidAdVideoStart: function(){
                vpaidStartActions();
                console.log("AdVideoStart", $item[0].data.systemName);
            },
            vpaidAdVideoFirstQuartile: function(){
                console.log("AdVideoFirstQuartile");
                //vpaidStartActions();
            },
            vpaidAdVideoMidpoint: function(){
                console.log("AdVideoMidpoint");
            },
            vpaidAdVideoThirdQuartile: function(){
                console.log("AdVideoThirdQuartile");
            },
            vpaidAdVideoComplete: function(){
                console.log("AdVideoComplete", $item[0].data.systemName);
            },
            vpaidAdUserAcceptInvitation: function(){
                console.log("AdUserAcceptInvitation");
            },
            vpaidAdUserMinimize: function(){
                console.log("AdUserMinimize");
            },
            vpaidAdUserClose: function(){
                console.log("AdUserClose");
            },
            vpaidAdPaused: function(){
                console.log("AdPaused");
            },
            vpaidAdPlaying: function(){
                console.log("AdPlaying");
            },
            vpaidAdErrorVpaid: function(){
                console.log("AdErrorVpaid");
            },
            vpaidAdLog: function(){
                console.log("AdLog");
            },
            vpaidAdViewable: function(){
                console.log("AdViewable");
            },
            vpaidAdReady: function(){
                console.log("AdReady", $item[0].data.systemName);
                $item[0].data.adready = true;
                if($item.is(":first-child")){
                    vpaidStartActions();
                };
            }
        };
        function vpaidStartActions(){
            if(!vpaidStartActions.state){
                vpaidDispatch("started", $item);
                console.log("Объвление показывается, показ засчитан");
                vpaidStartActions.state = true;
            };
        };
        vpaidStartActions.state = false;
        var vpaidCallbacks = {
            AdStarted:              cbFns.vpaidStartAd,
            AdStopped:              cbFns.vpaidStopAd,
            AdSkipped:              cbFns.vpaidSkipAd,
            AdLoaded:               cbFns.vpaidAdLoaded,
            AdLinearChange:         cbFns.vpaidAdLinearChange,
            AdSizeChange:           cbFns.vpaidAdSizeChange,
            AdExpandedChange:       cbFns.vpaidAdExpandedChange,
            AdSkippableStateChange: cbFns.vpaidAdSkippableStateChange,
            AdDurationChange:       cbFns.vpaidAdDurationChange,
            AdRemainingTimeChange:  cbFns.vpaidAdRemainingTimeChange,
            AdVolumeChange:         cbFns.vpaidAdVolumeChange,
            AdImpression:           cbFns.vpaidAdImpression,
            AdClickThru:            cbFns.vpaidAdClickThru,
            AdInteraction:          cbFns.vpaidAdInteraction,
            AdVideoStart:           cbFns.vpaidAdVideoStart,
            AdVideoFirstQuartile:   cbFns.vpaidAdVideoFirstQuartile,
            AdVideoMidpoint:        cbFns.vpaidAdVideoMidpoint,
            AdVideoThirdQuartile:   cbFns.vpaidAdVideoThirdQuartile,
            AdVideoComplete:        cbFns.vpaidAdVideoComplete,
            AdUserAcceptInvitation: cbFns.vpaidAdUserAcceptInvitation,
            AdUserMinimize:         cbFns.vpaidAdUserMinimize,
            AdUserClose:            cbFns.vpaidAdUserClose,
            AdPaused:               cbFns.vpaidAdPaused,
            AdPlaying:              cbFns.vpaidAdPlaying,
            AdError:                cbFns.vpaidAdError,
            AdErrorVpaid:           cbFns.vpaidAdErrorVpaid,
            AdLog:                  cbFns.vpaidAdLog,
            AdViewable:             cbFns.vpaidAdViewable,
            AdReady:                cbFns.vpaidAdReady
        };
    }

    /*
    function CodeInit(ads){
        this.ads = ads;
        this.adIndex = 0; // index ad в текущей коллекции
        this.ads = ads; // коллекция ad текущего кода
        this.init = function(ads){
            this.checkCurrent();
        };
        this.checkCurrent = function(){
            let item = this.ads[this.adIndex],
                creatives = item.creatives,
                mediaFiles = item.creatives[0].mediaFiles;
                if(item.extensions.length){
                    extensions = item.extensions[0].children;
                };


            //Вначале проверяем есть ли линейный креатив
            let isLinear = creatives.some((item, i, arr) => {
                return item.type === "linear";
            });
            if(isLinear){
                //Формируем список всех необходимых опций для запуска.
                extensions.forEach(function(item, i, arr){
                    if(item.name !== "#text"){
                        opts.ext[item.name] = item.value;
                    }
                });
                if(item.creatives[0].duration) opts.duration = item.creatives[0].duration;
                if(item.creatives[0].skipDelay) opts.skipDelay = item.creatives[0].skipDelay;

                self.tracker = new VAST.VASTTracker(vast, item, item.creatives[0]);

                console.log(vast);
                console.log(item);
                console.log(item.creatives[0]);
                console.log(self.tracker);

                //self.tracker.on("creativeView", function(){});

                opts.mediaFiles = mediaFiles;
                //Делаем проверку на интерактивную рекламу
                if(item.creatives[0].mediaFiles[0].apiFramework === "VPAID"){
                    try{
                        self.type = "vpaid";
                        self.vpaid.init(item.creatives[0]);
                    }catch(e){
                        //Если во время последующей обработки возникает ошибка,
                        //то переходим к следующему ads
                        console.log(e);
                        this.nextAd();
                    }
                }else{
                    try{
                        //Если дошли до сюда и всё ок, то переходим к проверке 
                        //медиафайла на соответствие параметрам и выбору
                        //подходящего качества.
                        self.type = "vast";
                        console.log("Подготовка к запуску васта");
                        self.creative = item.creatives[0];
                        self.$dom.skipTime.text(opts.skipDelay);
                        this.selectMedia(mediaFiles);
                    }catch(e){
                        //Если во время последующей обработки возникает ошибка,
                        //то переходим к следующему ads
                        this.nextAd();
                    }
                };
            }else{
                //Если нету, то переходим к следующему ads
                vast.next();
            };
        };
        this.selectMedia = function(mediaFiles){
            let mediaFile;
            for(let i = 0; mediaFiles.length > i; i++){
                let bitrate = mediaFiles[i].bitrate;
                if(mediaFiles[i].mimeType == opts.mimeType && bitrate >= opts.bitrateMin && bitrate <= opts.bitrateMax){
                    mediaFile = mediaFiles[i];
                    break;
                };
            };
            //Если не один из файлов не подошел под желаемые параметры, 
            //то пытаемся запустить первый в списке
            if(!mediaFile){
                mediaFile = mediaFiles[0];
            };
            self.mediaFile = mediaFiles[0];
            self.video.src = mediaFile.fileURL;
            self.state = 3;
            if(opts.autostart == true || opts.ext.autostart == true){
                self.start();
            };
        };
        this.nextAd = function(skipAds){
            this.adIndex++;
            //Проверяем есть ли ещё доступные рекламы
            //Если нету ads в текущем васте, то возвращаем проверяем следующий васт;
            if(this.adIndex >= ads.ads.length || skipAds){
                console.log("В этом васте больше нету доступных ads");
                console.log("Проверяем следующий код");
                opts.ext = {};
                self.waitTime.stop();
                vastRoll.next();
                //Надо передать опцию self.isNext = true; В следующий код
                //Сохранить её на протяжении всего перебора внутри этого кода
                //И удалить при удачном показе рекламы либо при переходе к следующему коду
                return false;
            };
            console.log("Проверяем следующий ads");
            createPlayer(opts.wrapper);
            this.checkCurrent(self.adIndex);
        };
    };
    */

    window.Radish = Radish;

})();







function cEventDispatcher(o) {
    var L = o.__listeners = {}, E = "CustomEvent";
    o["add" + E] = function(n, fn) { L[n] = L[n] || []; L[n].push(fn); };
    o["remove" + E] = function(n, fn) { var a = L[n]; for (var i = 0; i < a.length; i++) if (a[i] === fn) a.splice(i, 1);};
    return function() { var a = Array.prototype.slice.call(arguments); var l = L[a.shift()]; if (l)  for (var i = 0; i < l.length; i++) l[i].apply(l[i], a)};
}
