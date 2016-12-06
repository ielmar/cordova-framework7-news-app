// function to call webworker codes inside the file
function getScriptPath(foo){
	return window.URL.createObjectURL(new Blob([foo.toString().match(/^\s*function\s*\(\s*\)\s*\{(([\s\S](?!\}$))*[\s\S])/)[1]],{type:'text/javascript'}));
}

// register webworker. as chrome does not allow a local file to be loaded
var worker1 = function(){
	// write worker codes inside this function
	"use strict";

	// import socket.io into worker function
	importScripts('https://cdnjs.cloudflare.com/ajax/libs/socket.io/1.5.0/socket.io.min.js');

	// connect to socket
	var socket = io('http://node.qafqazinfo.az:8080');

	// listen to events from app.js
	addEventListener('message', function(e) {
		var data = e.data;
		var requestSent = false;
		// we define commands for the app
		// this function is called first time the app is opened
		if(data.command=='getCats')
		{
			// send request to get news
			socket.emit('getLastNews');
			requestSent = true;

			// send request to get categories
			socket.emit('getCategories');
		}

		// get last news
		if(data.command=='getLastNews')
		{
			// if requestSent is true, do Nothing
			if(requestSent)
				return;

			requestSent = true;
			// if lastNewsId is not present, it is first time that this function is called.
			// load last news
			var lastNewsId = data.data;
			if(lastNewsId === null || lastNewsId === 'undefined')
				socket.emit('getLastNews');
			else
			{
					socket.emit('moreLastNews', lastNewsId);
			}
		}

		// get category news
		if(data.command == 'getCategoryNews')
		{
			// if requestSent is true, do Nothing
			if(requestSent)
				return;

			requestSent = true;
			// if lastNewsId is not present, it is first time that this function is called.
			// load last news
			var categoryData = data.data;

			if(categoryData.lastId === 0)
			{
					socket.emit('getCategoryNewsById', {id: categoryData.id});
			}
			else
			{
					socket.emit('getCategoryNewsById', {id: categoryData.id, lastId: categoryData.lastId});
			}
		}

		// will be used with infinite scroll and bring older news items than given id
		if(data.command=='getMoreNews')
		{
			if(requestSent)
			return;

			requestSent = true;

			var oldestNewsId = data.data;
			if(data.indexOrNews === 'index' || data.catId === undefined)
			{
				socket.emit('moreNews', oldestNewsId);
			}
			else
			{
				socket.emit('getMoreRelatedNewsById', data.id, data.catId, data.pageNo);
			}
		}

		// get news by id
		if(data.command=='getNews')
		{
			if(requestSent)
			return;

			requestSent = true;

			var newsId = data.data;

			if(Number.isInteger(parseInt(newsId)))
			{
				console.log('ask for news');
				socket.emit('getNewsForMobileById', newsId);
			}
		}

		// get news by id
		if(data.command=='getPhotosessionById')
		{
			if(requestSent)
			return;

			requestSent = true;

			var newsPhotosessionId = data.data;
			if(newsPhotosessionId)
			{
				socket.emit('getPhotosessionById', newsPhotosessionId);
			}
		}

		// get news view count by id
		if(data.command=='getViewCountById')
		{
			if(requestSent)
			return;

			requestSent = true;

			var newsItemId = data.data;
			if(newsItemId)
			{
				socket.emit('getViewCountById', newsItemId);
			}
		}

		// get relatedNews by id
		if(data.command == 'getRelatedNewsById')
		{
			if(requestSent)
			return;

			requestSent = true;

			var relatedNewsData = data.data;
			socket.emit('getRelatedNewsById', relatedNewsData.id, relatedNewsData.cat_id);
		}

		if(data.command=='search')
		{
			if(requestSent)
			return;

			requestSent = true;

			var query = data.query;
			var pageNo = data.pageNo;

			socket.emit('search', query, pageNo);
		}

		socket.on('categories', function(news){
				var cats = JSON.stringify(news);
				postMessage({command: 'categories', data: cats});
		});

		socket.on('lastNews', function(news){
			if(requestSent)
			{
				if(news==='')
				{
					postMessage({command: 'endPullToRefresh'});
				}
				else
				{
					postMessage({command: 'lastNews', data: JSON.stringify(news)});
				}
				requestSent = false;
			}
		});

		socket.on('searchResult', function(news){
			if(requestSent)
			{
				postMessage({command: 'searchResult', data: JSON.stringify(news)});
				requestSent = false;
			}
		});

		socket.on('categoryNews', function(news){
			if(requestSent)
			{
				postMessage({command: 'categoryNews', data: JSON.stringify(news)});
				requestSent = false;
			}
		});

		socket.on('moreNews', function(news){
			if(requestSent)
			{
				postMessage({command: 'moreNews', data: JSON.stringify(news)});
				requestSent = false;
			}
		});

		socket.on('newsItem', function(newsItem){
			if(requestSent)
			{
				postMessage({command: 'news', data: JSON.stringify(newsItem)});
			}
		});

		socket.on('newsId', function(news){
			if(requestSent)
			{
				postMessage({command: 'news', data: JSON.stringify(news),  id: news.id});
			}
		});

		socket.on('relatedNews', function(news){
			if(requestSent)
			{
				postMessage({command: 'relatedNews', data: JSON.stringify(news)});
				requestSent = false;
			}
		});

		socket.on('moreRelatedNews', function(news){
			if(requestSent)
			{
				postMessage({command: 'moreRelatedNews', data: JSON.stringify(news)});
				requestSent = false;
			}
		});

		socket.on('viewCount', function(count){
			if(requestSent)
			{
				postMessage({command: 'viewCount', data: JSON.stringify(count)});
			}
		});

		socket.on('photosession', function(photos){
			if(requestSent)
			{
				if(photos.photos.length > 0 && photos.photos[0].id)
				{
					postMessage({command: 'photosession', data: JSON.stringify(photos)});
				}
			}
		});


	}, false);

};
// webworker script ends here

var worker = new Worker(getScriptPath(worker1));

worker.onmessage = function(event) {
	var data = event.data;

	if(data.command == 'categories')
	{
		window.localStorage.setItem('categories', data.data);

		var htmlCategories = categoriesTemplate(JSON.parse(data.data));

		$$('.categories ul').html(htmlCategories);

//		myApp.hideIndicator();
	}

	// end pull-to-refresh-content event
	if(data.command == 'endPullToRefresh')
	{
		myApp.pullToRefreshDone();
	}

	// if no localStorage for the category, set it the localStorage
	if(data.command == 'categoryNews')
	{
		var catNews = JSON.parse(data.data);
		var catId = catNews.news[0].cat_id;
		var catLastNews = window.localStorage.getItem('cat_lastNews_'+catId);

		if(catLastNews === undefined || catLastNews === null)
		{
			myApp.hideIndicator();
		}

		// save received data to the localStorage and set it to the category
		// window.localStorage.removeItem('cat_lastNews_'+catId);
		window.localStorage.setItem('cat_lastNews_'+catId, data.data);

		var htmlCatNews = categoryNewsTemplate(catNews);

		$$('.cat .content-block').html(htmlCatNews);
	}

	if(data.command == 'searchResult')
	{
		var searchResult = JSON.parse(data.data);
		var htmlSearch = '';
		if (searchResult.news.length > 0) {
			htmlSearch = categoryNewsTemplate(searchResult);
		}
		$$('.searchbar-found .content-block').append(htmlSearch);
		myApp.hideIndicator();
	}

	if(data.command == 'lastNews')
	{
		// get lastNews data from localStorage
		var lastNews = window.localStorage.getItem('lastNews');
		// data coming from server
		var lastNewsNewData = JSON.parse(data.data);

		var newArr = '', nonExistingArr = [], html = '';
		// last news already exists in localStorage
		if(lastNews !== null)
		{
			var existingLastNewsData = JSON.parse(lastNews).news;

			// check if id already exists in localStorage
			// loop through moreNews and get only non existing news
			lastNewsNewData.news.forEach(function(newsItem){

				// if id is not in the app, add it to lastnews array and to the app index
				if($$('.index .content-block a.p'+newsItem.id).length===0)
				{
					nonExistingArr.push(newsItem);
				}
			});

			// if nonExistingArr is not empty, concatenate
			if(nonExistingArr.length > 0)
			{
				// compile only news that is not already in page
				html = categoryNewsTemplate({news: nonExistingArr});

				newArr = nonExistingArr.concat(JSON.parse(lastNews).news);
				// remove old ids if number are more than 20
				// if we insert 3 new ids, remove old 3 ids
				newArr.splice(19, nonExistingArr.length);
				lastNewsNewData.news = newArr;
				window.localStorage.setItem('lastNews', JSON.stringify(lastNewsNewData));
			}
		}
		else
		{
			// last news not exists in localStorage. it's called for the first time
			window.localStorage.setItem('lastNews', data.data);

			// compile the whole arrived data as it is first time
			 html = categoryNewsTemplate(lastNewsNewData);
		}

		window.localStorage.setItem('lastNewsId', lastNewsNewData.lastId);

		$$('.index .content-block').prepend(html);
		myApp.oldestId = $$('.content-block a:last-child').data('newsid');

		myApp.hideIndicator();
		myApp.pullToRefreshDone();

		// delete older 100 news ids
		var myRegexp = /news_id_(\d+)/;
		for ( var i = 0, len = window.localStorage.length; i < len; ++i ) {
			// var newsItem = window.localStorage.getItem( window.localStorage.key( i ) );
			var newsItem = window.localStorage.key( i ) ;
			var match = myRegexp.exec(newsItem);
			if(match !== null)
			{
				if((lastNewsNewData.lastId-match[1]) > 100)
				{
					// delete old news item
					window.localStorage.removeItem(newsItem);

					// delete old photosession
					window.localStorage.removeItem('news_id_'+match[1]+'_photosession');
				}
			}
		}
	}

	// webworker sent the app 'moreNews' command
	if(data.command == 'moreNews')
	{
		var moreNews = JSON.parse(data.data);
		var oldestId = moreNews.news[moreNews.news.length-1].id;

		if(myApp.oldestId != oldestId)
		{
			var newMoreNewsDataArr = [];
			var htmlPreviousNews = '';

			// check if news page or index page is active
			if($$('.others a:last-child').data('newsid') === undefined)
			{
					// index page

					// loop through moreNews and get only non existing news
					moreNews.news.forEach(function(news){
						// only non existing news items
						if($$('.index .content-block a.p'+news.id).length===0)
						{
							newMoreNewsDataArr.push(news);
						}
					});

					// set moreNews.news to newMoreNewsDataArr
					moreNews.news = newMoreNewsDataArr;

					// compile template with only non existing data
					htmlPreviousNews = categoryNewsTemplate(moreNews);

					// Append new items
					$$('.index .content-block').append(htmlPreviousNews);

					// Last loaded index
					myApp.lastIndex = $$('.index .content-block a').length;
					myApp.oldestId = $$('.index .content-block a:last-child').data('newsid');
			}
			// else
			// {
			// 	// news page
			//
			// 	// compile template with only non existing data
			// 	htmlPreviousNews = categoryNewsTemplate(moreNews);
			//
			// 	// Append new items
			// 	$$('.others').append(htmlPreviousNews);
			//
			// 	// Last loaded index
			// 	myApp.lastIndex = $$('.others a').length;
			// 	myApp.oldestId = $$('.others a:last-child').data('newsid');
			// }

		}

	}

	if(data.command == 'news')
	{
		var news = JSON.parse(data.data);
		var newsExists = window.localStorage.getItem('news_id_'+news.id);
		// if not exists on localStorage, add it
		if(!newsExists)
		{
			window.localStorage.setItem('news_id_'+news.id, data.data);
		}
		else
		{
			var existingNews = JSON.parse(newsExists);
			// if data.id is returned, it is in news page. we are checking if news has been updated
			// news exists on localStorage. check if news is changed
			if(news.news_id !== undefined &&
				Object.is(news.news_item.id, existingNews.news_item.id) &&
			(!Object.is(news.news_item.content, existingNews.news_item.content) ||
			!Object.is(news.news_item.title, existingNews.news_item.title) ||
			!Object.is(news.news_item.title_extra, existingNews.news_item.title_extra)))
			{
				window.localStorage.setItem('news_id_'+news.id, data.data);
				var htmlNews = newsTemplate(news.news_item);
				$$('.news_inner .news').html(htmlNews);
			}
		}
	}

	if(data.command == 'photosession')
	{
		var newsPhotosession = JSON.parse(data.data);
		window.localStorage.setItem('news_id_'+newsPhotosession.id+'_photosession', data.data);
		if($$('.photosession.p'+newsPhotosession.id).html().length === 0)
		{
			var htmlNewsPhotosession = newsPhotosessionTemplate(newsPhotosession);

			$$('.photosession.p'+newsPhotosession.id).append(htmlNewsPhotosession);
		}
	}

	if(data.command == 'viewCount')
	{
		var viewCount = JSON.parse(data.data);
		$$('.news_inner .news-time span').html('<i class="icon icon-eye"></i> '+viewCount[0].viewed);
	}

	if(data.command == 'relatedNews')
	{
		if($$('.news_inner .others').html().trim()==='')
		{
			var relatedNewsData = JSON.parse(data.data);
			var relatedNewsHtml = categoryNewsTemplate(relatedNewsData);

			$$('.news_inner .others').html('<div class="content-block-title other_news">Digər xəbərlər</div>'+relatedNewsHtml);
		}
	}

	if(data.command == 'moreRelatedNews')
	{
		var newMoreRelatedNewsDataArr = [];
		var moreRelatedNewsData = JSON.parse(data.data);

		// loop through moreNews and get only non existing news
		moreRelatedNewsData.news.forEach(function(news){
			// only non existing news items
			if($$('.others a.p'+news.id).length===0)
			{
				newMoreRelatedNewsDataArr.push(news);
			}
		});

		// set moreNews.news to newMoreNewsDataArr
		moreRelatedNewsData.news = newMoreRelatedNewsDataArr;

		if(newMoreRelatedNewsDataArr.length>0)
		{
			var moreRelatedNewsHtml = categoryNewsTemplate(moreRelatedNewsData);

			$$('.news_inner .others').append(moreRelatedNewsHtml);
		}
	}
};

var $$ = Dom7;

var myApp = new Framework7({
    animateNavBackIcon:true,
		swipePanel:'left',
		fastClicks: true,
    precompileTemplates: true,
    template7Pages: true,
		uniqueHistory: true,
		init: false
});

var mainView = myApp.addView('.view-main', {
    dynamicNavbar: true,
		allowDuplicateUrls: true,
    domCache: true
});

var categoryNewsTemplate = Template7.compile($$('#categoryNews').html());
var categoriesTemplate = Template7.compile($$('#categories').html());
var newsTemplate = Template7.compile($$('#news').html());
var newsPhotosessionTemplate = Template7.compile($$('#newsphotosession').html());

$$(document).on('pageInit', function (e) {
	var page = e.detail.page;

	myApp.backbuttonPressCount = 0;

	if(page.name === 'index')
	{
		// app has just been initiated. get categories and lastNews
		var isUpdate = window.localStorage.getItem('isUpdate');
		var cats = window.localStorage.getItem('categories');

        // on every release increase this number by one
		if(!isUpdate || isUpdate === '2')
		{
      for ( var i = 0, len = window.localStorage.length; i < len; ++i ) {
          var newsItem = window.localStorage.key( i ) ;

          // delete old news item
          window.localStorage.removeItem(newsItem);
      }
      var version = !isUpdate?1:parseInt(isUpdate)+1;
			window.localStorage.setItem('isUpdate',version);
			cats = null;
		}

		var lastNews = window.localStorage.getItem('lastNews');

		// if categories not exist yet, either app is running for the first time,
		// or localstorage data has been wiped somehow
		if(cats === null)
		{
			// show preloader till we will be getting data from the server
			myApp.showIndicator();

			var webworkerArray= [];
			webworkerArray.command = 'getCats';
			worker.postMessage(webworkerArray);
		}
		else
		{
			// we have categories data in localStorage
			var html = categoriesTemplate(JSON.parse(cats));

			$$('.categories ul').html(html);

			// we check lastNews data from localStorage just in case it is wiped somehow
			if(lastNews === null)
			{
				// show preloader till we will be getting data from the server
				myApp.showIndicator();

				var lastNewsWebworkerArray= [];
				lastNewsWebworkerArray.command = 'getLastNews';
				worker.postMessage(lastNewsWebworkerArray);
			}
			else
			{
				// we have lastNews in localStorage
				html = categoryNewsTemplate(JSON.parse(lastNews));

				$$('.index .content-block').html(html);

				// hide preloader but check for the latest news
				myApp.hideIndicator();

				// send lastNews request to the server
				var lastNewsId = window.localStorage.getItem('lastNewsId');
				var lastNews2WebworkerArray = [];
				lastNews2WebworkerArray.command = 'getLastNews';
				lastNews2WebworkerArray.data = lastNewsId;
				worker.postMessage(lastNews2WebworkerArray);
			}
		}
	}

	// news page is called, load the news from localStorage and send request to the server
	// to check if any information has been changed on the server
	if(page.name === 'newsInner')
	{
		var newsId = page.query.id;
		var news = window.localStorage.getItem('news_id_'+newsId);
		var newsData = JSON.parse(news);
		var htmlNews = newsTemplate(newsData.news_item);
		$$('.news_inner .news').html(htmlNews);

		// send get request to the server
		var newsWebworkerArray = [];
		newsWebworkerArray.command = 'getNews';
		newsWebworkerArray.data = newsId;
		worker.postMessage(newsWebworkerArray);

		// get view count for this id
		var newsViewCountWebworkerArray = [];
		newsViewCountWebworkerArray.command = 'getViewCountById';
		newsViewCountWebworkerArray.data = newsId;
		worker.postMessage(newsViewCountWebworkerArray);

		// check if the news has photosession
		// check if newsid photosession is on localStorage
		var newsItemPhotosession = window.localStorage.getItem('news_id_'+newsId+'_photosession');
		// no photosession data in the localStorage
		if(newsItemPhotosession === null)
		{
			// send photosession request to the server
			var newsPhotosessionWebworkerArray = [];
			newsPhotosessionWebworkerArray.command = 'getPhotosessionById';
			newsPhotosessionWebworkerArray.data = newsId;
			worker.postMessage(newsPhotosessionWebworkerArray);
		}
		else
		{
			var htmlNewsPhotosession = newsPhotosessionTemplate(JSON.parse(newsItemPhotosession));
			$$('.news_inner .photosession').append(htmlNewsPhotosession);
		}

		// wait for a second and then send relatedNews request
		setTimeout(function(){
			// get relatedNews
			var relatedNewstWebworkerArray = [];
			relatedNewstWebworkerArray.command = 'getRelatedNewsById';
			relatedNewstWebworkerArray.data = {id: newsId, cat_id: newsData.news_item.cat_id};
			worker.postMessage(relatedNewstWebworkerArray);
		}, 1000);

		// add GA tracking
		// window.analytics.trackView(htmlNews.title);
	}

	// show category news
	if(page.name === 'cat')
	{
		$$('.categories a').addClass('second');

		var catId = page.query.id;

		// check if categoryNews exists in localStorage
		var catLastNews = window.localStorage.getItem('cat_lastNews_'+catId);

		// no data in localStorage. send request
		if(catLastNews === null || catLastNews === undefined)
		{
			// show preloader till we will be getting data from the server
			myApp.showIndicator();
		}
		else
		{
			// show local data while new data is arrived

			var htmlCatNews = categoryNewsTemplate(JSON.parse(catLastNews));

			$$('.cat .content-block').prepend(htmlCatNews);
		}


		var catData = [];
		catData.id = catId;
		catData.lastId = 0;
		// send get request to the server
		var categoryNewsWebworkerArray = [];
		categoryNewsWebworkerArray.command = 'getCategoryNews';
		categoryNewsWebworkerArray.data = catData;
		worker.postMessage(categoryNewsWebworkerArray);
	}

});

$$(document).on('pageReinit', function (e) {
	var page = e.detail.page;

	myApp.backbuttonPressCount = 0;

	if(page.name === 'newsInner')
	{
		var newsId = page.query.id;
		var news = window.localStorage.getItem('news_id_'+newsId);
		var newsData = JSON.parse(news);
		var htmlNews = newsTemplate(newsData.news_item);
		$$('.news_inner .news').html(htmlNews);

		// send get request to the server
		var newsWebworkerArray = [];
		newsWebworkerArray.command = 'getNews';
		newsWebworkerArray.data = newsId;
		worker.postMessage(newsWebworkerArray);

		// get view count for this id
		var newsViewCountWebworkerArray = [];
		newsViewCountWebworkerArray.command = 'getViewCountById';
		newsViewCountWebworkerArray.data = newsId;
		worker.postMessage(newsViewCountWebworkerArray);

		// check if the news has photosession
		// check if newsid photosession is on localStorage
		var newsItemPhotosession = window.localStorage.getItem('news_id_'+newsId+'_photosession');
		// no photosession data in the localStorage
		if(newsItemPhotosession === null)
		{
			// send photosession request to the server
			var newsPhotosessionWebworkerArray = [];
			newsPhotosessionWebworkerArray.command = 'getPhotosessionById';
			newsPhotosessionWebworkerArray.data = newsId;
			worker.postMessage(newsPhotosessionWebworkerArray);
		}
		else
		{
			var htmlNewsPhotosession = newsPhotosessionTemplate(JSON.parse(newsItemPhotosession));

			$$('.news_inner .photosession').append(htmlNewsPhotosession);
		}

		// wait for a second and then send relatedNews request
		setTimeout(function(){
			// get relatedNews
			var relatedNewstWebworkerArray = [];
			relatedNewstWebworkerArray.command = 'getRelatedNewsById';
			relatedNewstWebworkerArray.data = {id: newsId, cat_id: newsData.news_item.cat_id};
			worker.postMessage(relatedNewstWebworkerArray);
		}, 1000);

		// add GA tracking
		// window.analytics.trackView(htmlNews.title);
	}

	// show category news
	if(page.name === 'cat')
	{
		$$('.categories a').addClass('second');

		var catId = page.query.id;

		// check if categoryNews exists in localStorage
		var catLastNews = window.localStorage.getItem('cat_lastNews_'+catId);

		// no data in localStorage. send request
		if(catLastNews === null || catLastNews === undefined)
		{
			// show preloader till we will be getting data from the server
			myApp.showIndicator();
		}
		else
		{
			// show local data while new data is arrived

			var htmlCatNews = categoryNewsTemplate(JSON.parse(catLastNews));

			$$('.cat .content-block').prepend(htmlCatNews);
		}

		var catData = [];
		catData.id = catId;
		catData.lastId = 0;
		// send get request to the server
		var categoryNewsWebworkerArray = [];
		categoryNewsWebworkerArray.command = 'getCategoryNews';
		categoryNewsWebworkerArray.data = catData;
		worker.postMessage(categoryNewsWebworkerArray);
	}
});

$$(document).on('pageAfterBack', function (e) {

	var page = e.detail.page;

	// hide preloader in case cat is open
	myApp.hideIndicator();

	if(page.name === 'newsInner')
	{
		$$(".news_inner").scrollTop(0, 0, function(){});
		$$(".news_inner .news").html('');
		$$(".news_inner .others").html('');
	}

	if(page.name === 'cat')
	{
		$$(".cat").scrollTop(0, 0, function(){});
		$$(".cat .content-block").html('');
		$$('.categories a').removeClass('second');
	}

	if(page.name === 'search')
	{
		var mySearchbar = $$('.searchbar')[0].f7Searchbar;
		mySearchbar.clear();
		$$(".searchbar-found").scrollTop(0, 0, function(){});
		$$(".searchbar-found .content-block").html('');
	}
});

// refresh after app comes to front
document.addEventListener("resume", function(e){
	// send lastNews request to the server
	var lastNewsId = window.localStorage.getItem('lastNewsId');
	if(lastNewsId)
	{
		var lastNews2WebworkerArray = [];
		lastNews2WebworkerArray.command = 'getLastNews';
		lastNews2WebworkerArray.data = lastNewsId;
		worker.postMessage(lastNews2WebworkerArray);
	}
}, false);

document.addEventListener("backbutton", function(e){

	if(mainView.activePage.name == 'index')
	{
		myApp.backbuttonPressCount++;
	}

	if(myApp.backbuttonPressCount == 2)
	{
		navigator.app.exitApp();
	}
	else
		mainView.router.back();

}, false);


// Loading flag
myApp.loading = false;

// Max items to load
myApp.maxItems = 100;

// Append items per load
myApp.itemsPerLoad = 10;

// Attach 'infinite' event handler
$$('.infinite-scroll').on('infinite', function () {

	// check if we are on index page or news page or search page
	var newsPageOldestId = $$('.others a:last-child').data('newsid');
	var newsPageLastIndex = $$('.others a.card').length;

	var searchPageItemCount = $$('.searchbar-found a.card').length;

	var indexPageOldestId = $$('.index .content-block a:last-child').data('newsid');
	var indexPageLastIndex = $$('.index a.card').length;
	var indexOrNewsPage = '';
	// if undefined, we are on index page
	if(newsPageOldestId === undefined)
	{
		// index page

		// last loaded index
		myApp.lastIndex = indexPageLastIndex;
		myApp.oldestId = indexPageOldestId;
		indexOrNewsPage = 'index';
	}

	if (searchPageItemCount>0) {
		// search page

		indexOrNewsPage = 'search';
	}

	if(newsPageOldestId !== undefined)
	{
		// news page

		// last loaded index
		myApp.lastIndex = newsPageLastIndex;
		myApp.oldestId = newsPageOldestId;
		indexOrNewsPage = 'news';
	}

  // Exit, if loading in progress
  if (myApp.loading) return;

  // Set loading flag
  myApp.loading = true;

  // Emulate 1s loading
  setTimeout(function () {
    // Reset loading flag
    myApp.loading = false;

    if (myApp.lastIndex >= myApp.maxItems) {
      // Nothing more to load, detach infinite scroll events to prevent unnecessary loadings
      myApp.detachInfiniteScroll($$('.infinite-scroll'));
      // Remove preloader
      $$('.infinite-scroll-preloader').remove();
      return;
    }

		if(indexOrNewsPage === 'search')
		{
			var mySearchbar = $$('.searchbar')[0].f7Searchbar;
			var webworkerArray= [];
			webworkerArray.command = 'search';
			webworkerArray.query=mySearchbar.query;
			webworkerArray.pageNo = $$('.searchbar-found a.card').length;
			worker.postMessage(webworkerArray);
		}
		else
		{
			// send getMoreNews request to the server
			var moreNewsWebworkerArray = [];
			moreNewsWebworkerArray.command = 'getMoreNews';
			moreNewsWebworkerArray.data = myApp.oldestId;
			moreNewsWebworkerArray.id = $$('.news .content-block-title').data('id');
			moreNewsWebworkerArray.catId = $$('.news .content-block-title').data('catid');
			moreNewsWebworkerArray.pageNo = newsPageLastIndex;
			worker.postMessage(moreNewsWebworkerArray);
		}

  }, 1000);
});

// pull to refresh
$$('.pull-to-refresh-content').on('refresh', function (e) {
		// send lastNews request to the server
		var lastNewsId = window.localStorage.getItem('lastNewsId');
		var lastNews2WebworkerArray = [];
		lastNews2WebworkerArray.command = 'getLastNews';
		lastNews2WebworkerArray.data = lastNewsId;
		worker.postMessage(lastNews2WebworkerArray);

		// wait for 3 seconds and end pull-to-refresh-content event
		setTimeout(function(){
			myApp.pullToRefreshDone();
		}, 3000);
});

// set the time and date when left panel is opening
$$('.panel-left').on('open', function () {
	myApp.getTime();
	myApp.getDate();
	// set date and time and refresh it every second
	myApp.setInterval = setInterval(function(){
		myApp.getTime();
		myApp.getDate();
	}, 1000);
});

// clear timeout for date and time
$$('.panel-left').on('closed', function () {
    clearInterval(myApp.setInterval);
});

$$(document).on('click', '.categories a.second', function (e) {
	var catId = $$(this).data('catid');

	// check if categoryNews exists in localStorage
	var catLastNews = window.localStorage.getItem('cat_lastNews_'+catId);

	// no data in localStorage. send request
	if(catLastNews === null || catLastNews === undefined)
	{
		// show preloader till we will be getting data from the server
		myApp.showIndicator();
	}
	else
	{
		// show local data while new data is arrived

		var htmlCatNews = categoryNewsTemplate(JSON.parse(catLastNews));

		$$('.cat .content-block').prepend(htmlCatNews);
	}

	var catData = [];
	catData.id = catId;
	catData.lastId = 0;
	// send get request to the server
	var categoryNewsWebworkerArray = [];
	categoryNewsWebworkerArray.command = 'getCategoryNews';
	categoryNewsWebworkerArray.data = catData;
	worker.postMessage(categoryNewsWebworkerArray);

	// add GA tracking
	// window.analytics.trackView(newsData.news_item.title);
});

$$(document).on('click', '.others a', function (e) {

	var newsId = $$(this).data('newsid');
	var news = window.localStorage.getItem('news_id_'+newsId);
	var newsData = JSON.parse(news);
	var htmlNews = newsTemplate(newsData.news_item);
	$$('.news_inner .news').html(htmlNews);
	$$(".news_inner").scrollTop(0, 0, function(){});

	// send get request to the server
	var newsWebworkerArray = [];
	newsWebworkerArray.command = 'getNews';
	newsWebworkerArray.data = newsId;
	worker.postMessage(newsWebworkerArray);

	// get view count for this id
	var newsViewCountWebworkerArray = [];
	newsViewCountWebworkerArray.command = 'getViewCountById';
	newsViewCountWebworkerArray.data = newsId;
	worker.postMessage(newsViewCountWebworkerArray);

	// check if the news has photosession
	// check if newsid photosession is on localStorage
	var newsItemPhotosession = window.localStorage.getItem('news_id_'+newsId+'_photosession');
	// no photosession data in the localStorage
	if(newsItemPhotosession === null)
	{
		// send photosession request to the server
		var newsPhotosessionWebworkerArray = [];
		newsPhotosessionWebworkerArray.command = 'getPhotosessionById';
		newsPhotosessionWebworkerArray.data = newsId;
		worker.postMessage(newsPhotosessionWebworkerArray);
	}
	else
	{
		var htmlNewsPhotosession = newsPhotosessionTemplate(JSON.parse(newsItemPhotosession));

		$$('.news_inner .photosession').append(htmlNewsPhotosession);
	}

	// wait for a second and then send relatedNews request
	setTimeout(function(){
		// get relatedNews
		var relatedNewstWebworkerArray = [];
		relatedNewstWebworkerArray.command = 'getRelatedNewsById';
		relatedNewstWebworkerArray.data = {id: newsId, cat_id: newsData.news_item.cat_id};
		worker.postMessage(relatedNewstWebworkerArray);
	}, 1000);

	// add GA tracking
	window.analytics.trackView(newsData.news_item.title);
});

myApp.getDate = function () {
	var currentDay = window.localStorage.getItem('currentDay');
	var currentDate = window.localStorage.getItem('currentDate');

	var today = new Date();
	day = today.getDate();

	if (!currentDate || currentDay != day) {
		var days = new Array("B.", "B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş.");
		var months = new Array("Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr");

		weekday = today.getDay();
		month = today.getMonth();
		year = today.getFullYear();

		currentDate = days[weekday] + ", " + day + " " + months[month] + " " + year;
		window.localStorage.setItem('currentDay', day);
		window.localStorage.setItem('currentDate', currentDate);
	}

	$$('.menu .content-block-title p').html(currentDate);
};
// used for writing current time
// checks localStorage for currentTime value.
// if not calculates and writes to localStorage
myApp.getTime = function () {
	var datetime = new Date();
	var currentTime = ('0' + datetime.getHours()).slice(-2) + ':' + ('0' + datetime.getMinutes()).slice(-2);

	$$('.menu .content-block-title time').html(currentTime);
};


// sharing section
$$(document).on('click','.share',function(){
	var options = 				{
			message: $$('.news_inner .content').html().replace(/<(?:.|\n)*?>/gm, ''),
			subject: $$('.news_inner .content-block-title').html().replace(/<(?:.|\n)*?>/gm, ''),
			url: 'http://www.qafqazinfo.az/'+$$('.news_inner .content-block-title').data('slug'),
			chooserTitle: 'Xəbəri paylaş'
		};
	window.plugins.socialsharing.shareWithOptions(
		options,
		function(){

		}, function(){

		});
});

$$(document).on('keyup', function(e){
	if(e.which === 13)
	{
		var mySearchbar = $$('.searchbar')[0].f7Searchbar;
		var webworkerArray= [];
		webworkerArray.command = 'search';
		webworkerArray.query=mySearchbar.query;
		webworkerArray.pageNo = $$('.searchbar-found a.card').length;
		worker.postMessage(webworkerArray);
		myApp.showIndicator();
	}
});

var mySearchbar = myApp.searchbar('.searchbar', {
   customSearch: true,
	// onSearch: function(s) {
	// 	if (mySearchbar.query.trim() === '') {
	// 		$$('.popup .search-results').html('');
	// 		return;
	// 	}
	// 	// wait for a second and search
	// 	setTimeout(function(){
	// 		// var webworkerArray= [];
	// 		// webworkerArray.command = 'search';
	// 		// webworkerArray.query=mySearchbar.query;
	// 		// webworkerArray.data=yolnishanlari;
	// 		// worker.postMessage(webworkerArray);
	// 		console.log(mySearchbar.query);
	// 		myApp.showIndicator();
	// 	}, 1000);
	// },
	onClear: function(s) {
		$$('.searchbar-found ul').html('');
	}
});

myApp.init();

// add links
document.addEventListener("deviceready", function(e){

	// hide splashscreen if document is ready
	if (typeof navigator.splashscreen != 'undefined') {
		setTimeout(function () {
			navigator.splashscreen.hide();
		}, 2500);
	}

	// add GA id and start it
	window.analytics.startTrackerWithId('UA-4741780-21');



}, false);
