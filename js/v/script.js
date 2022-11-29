$(function(){
	console.log(123);

		    let urlParamsStr = "?player="+vastStatParams().player+"&device="+vastStatParams().device+"&referrer="+vastStatParams().referrer;
		    let prerollUrl = 'https://webcod.pro/v/wrapper-preroll.xml'+urlParamsStr;
		    let midrollUrl = 'https://webcod.pro/v/wrapper-preroll.xml'+urlParamsStr;
			VAST.opts = {
				preroll: {
					mimeType: 'video/mp4',
					bitrateMin: 0,
					bitrateMax: 9999,
					duration: 20, //Продолжительность рекламы по умолчанию
					delayed: 0, //Продолжительность рекламы по умолчанию
					skipDelay: 5, //Время до пропуска по умолчанию
					wrapper: ".vast-wrap",
					maxAds: 6, // максимально допустимое кол-во показов рекламы
					skipNextAds: true, // true/false - пропускать ли следующие ads внутри текущего кода при включенном параметре showNext
					timeout: 100, //Время для подбора рекламы 
					showAfterStart: false, //true/false - Показ плеера непосредственно после запуска рекламного ролика
					template: {
						skipText: {
							pre: "Реклама -",
							post: "сек."
						}
					}, 
					url: prerollUrl, //vast xml url

				},
				midroll: {
					mimeType: 'video/mp4',
					bitrateMin: 0,
					bitrateMax: 9999,
					duration: 20, //Продолжительность рекламы по умолчанию
					delayed: 0, //Продолжительность рекламы по умолчанию
					skipDelay: 5, //Время до пропуска по умолчанию
					wrapper: ".midroll-wrap",
					maxAds: 6, // максимально допустимое кол-во показов рекламы
					skipNextAds: true, // true/false - пропускать ли следующие ads внутри текущего кода при включенном параметре showNext
					timeout: 100, //Время для подбора рекламы 
					showAfterStart: true, //true/false - Показ плеера непосредственно после запуска рекламного ролика
					template: {
						skipText: {
							pre: "Реклама -",
							post: "сек."
						}
					}, 
					url: prerollUrl, //vast xml url
				},
				postroll: {
				}
			};

		    VAST.preroll = {
				client: new VAST.VASTClient(),
				playerOpts: VAST.opts.preroll,
		    };
		    VAST.midroll = {
		      client: new VAST.VASTClient(),
		      playerOpts: VAST.opts.midroll,
		    };
		    /*
		    VAST.postroll = {
		      client: new VAST.VASTClient(),
		      playerOpts: VAST.opts.postroll,
		    };
		    */

		    //var prerollPlayer = new Radish(opts, api);

		    var prerollPlayer = new Radish(VAST.preroll.client, false, VAST.opts.preroll);
		    VAST.preroll.player = prerollPlayer;

		    var midrollPlayer = new Radish(VAST.midroll.client, false, VAST.opts.midroll);
		    VAST.midroll.player = midrollPlayer;
		    // автозапуск
		    /*prerollPlayer.on("loaded", function(){
		    	this.start();
		    });*/





            /* *** TEST *** */

            $(function(){
            	console.log("LOAD");
		    	prerollPlayer.init();
			    prerollPlayer.addCustomEvent("created", function(e){
			    	console.log("player created, ads created", e);
			    });
			    prerollPlayer.addCustomEvent("update", function($slot){
			    	console.log("player updated");
			    });
			    prerollPlayer.addCustomEvent("error", function(e){
			    	console.log("error", e);
			    });    


			    $("#add_midroll").on("click", function(){
			    	midrollPlayer.init();
			    	setTimeout(function(){
			    		console.log("START MIDROLL");
			    		midrollPlayer.start();
			    	}, 10000);
			    	$(this).remove();
			    });
            });

            $("#add_start").on("click", function(){
            	prerollPlayer.start();
			    $(this).remove();
            });

		    function vastStatParams(){
				var playerType = 2;
				/*
				if($(".flowplayer").hasClass("is-playlist")){
				  playerType = "2";
				}else{
				  playerType = "1";
				};
				*/

				var deviceType = 1;
				/*
				if(bowser.mobile || bowser.tablet){
					deviceType = 2;
				}else{
					deviceType = 1;
				}
				*/

		    	return {
		    		player: playerType,
		    		device: deviceType,
		    		referrer: window.storageReferrer
		    	}
		    };
});