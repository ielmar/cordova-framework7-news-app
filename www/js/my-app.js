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

	// import dexie.js to work with indexeddb
	importScripts('https://unpkg.com/dexie@latest/dist/dexie.js');

	// connect to socket
	var socket = io('http://node.qafqazinfo.az:8080');

	// listen to events from app.js
	addEventListener('message', function(e) {
		// create database for qafqazinfo
		var db = new Dexie("qafqazinfo");
		db.version(1).stores({
			news: '++id, stripped_title, specialchared_title, news_date, news_time, news_day, news_img, content, cat_title, *cat_id',
			category: '++id, title'
		});

		var data = e.data;
		var requestSent = false;
		// we define commands for the app
		// this function is called every time the app is opened
		// it sends request to get last news
		if(data.command=='getCats')
		{
				requestSent = true;
				// send request to get news
				socket.emit('getLastNews');

				// get categories and send back to the app. if not exists, send request
				db.category.toArray().then(function (categories) {
					if(categories.length > 0)
					{
						postMessage({command: 'categories', data: JSON.stringify(categories)});
					}
					else
					{
						// categories not exist in the indexeddb. send request to get categories
						socket.emit('getCategories');
					}
			});

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
			{
				socket.emit('getLastNews');
			}
			else
			{
				socket.emit('moreLastNews', lastNewsId);
			}
		}

		// get category news
		if(data.command == 'getCategoryNews')
		{
			var categoryData = data.data;

			db.news.where('cat_id').equals(parseInt(categoryData.id)).reverse().sortBy('news_date').then(function(news) {
				news.shift();

				postMessage({command: 'categoryNews', data: JSON.stringify(news)});
			});
		}

		// will be used with infinite scroll and bring older news items than given id
		if(data.command=='getMoreNews')
		{
			console.log(data.indexOrNews);
			if(requestSent)
			return;

			requestSent = true;

			var oldestNewsId = data.data;
			if(data.indexOrNews === 'index' || data.catId === undefined)
			{
				db.news.where('id').below(parseInt(oldestNewsId)).limit(20).reverse().sortBy('news_date').then(function(news) {
					news.shift();

					if(news.length>0)
					{
							postMessage({command: 'moreNews', data: JSON.stringify(news)});
					}
					else
					{
						requestSent = true;
						socket.emit('moreNews', oldestNewsId);
					}
				});
			}

			if(data.indexOrNews === 'search')
			{
				// db.news.where('id').below(parseInt(oldestNewsId)).limit(20).reverse().sortBy('news_date').then(function(news) {
				// 	news.shift();
				//
				// 	if(news.length>0)
				// 	{
				// 			postMessage({command: 'moreNews', data: JSON.stringify(news)});
				// 	}
				// 	else
				// 	{
				// 		requestSent = true;
				// 		socket.emit('getMoreRelatedNewsById', data.id, data.catId, data.pageNo);
				// 	}
				// });
			}

		}

		// will be used with infinite scroll and bring older news items than given id
		if(data.command=='getMoreRelatedNews')
		{
			if(requestSent)
			return;

			requestSent = true;

			var oldestRelatedNewsId = data.id;
			var oldestRelatedNewsCatId = data.catId;

			db.news.where('cat_id').equals(parseInt(oldestRelatedNewsCatId)).limit(20).reverse().sortBy('news_date').then(function(news) {
				news.shift();

				if(news.length>0)
				{
					var newArray = [];
					news.forEach(function(newsItem){
						if(newsItem.id > parseInt(oldestRelatedNewsId) && newsItem.length < 10)
							newArray.push(newsItem);
					});

					if(newArray.length>0)
					{
						console.log(newArray);
						// postMessage({command: 'moreNews', data: JSON.stringify(news)});
					}
					else
					{
						console.log('related news data not more than 10');
						socket.emit('getMoreRelatedNewsById', data.id, data.catId, data.pageNo);
					}
				}
				else
				{
					console.log('no more related news data');
					requestSent = true;
					socket.emit('getMoreRelatedNewsById', data.id, data.catId, data.pageNo);
				}
			});

		}

		// get news by id. It tries to get the news from the database.
		// if news not exists in the database, send a socket request
		if(data.command=='getNewsById')
		{
			var newsId = data.data;

			db.news.where('id').equals(JSON.parse(newsId)).toArray().then(function (newsData) {
				// if news does not exist in the database, send a socket request
				if(newsData)
				{
					postMessage({command: 'news', data: JSON.stringify(newsData)});
				}
				else
				{
					socket.emit('getNewsForMobileById', newsId);
				}
			});
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

		// gets related news from indexeddb by given category id and posts to the app
		if(data.command == 'getRelatedNewsById')
		{
			var relatedNewsData = JSON.parse(data.data);
			db.news.where('cat_id').equals(parseInt(relatedNewsData.cat_id)).reverse().limit(10).sortBy('news_date').then(function(news) {
				news.shift();

				postMessage({command: 'relatedNews', data: JSON.stringify({news: news})});
				requestSent = false;

				// if we have less than 10 relatedNews for the id, send socket request
				if(news.length<10)
				{
					requestSent = true;
					socket.emit('getRelatedNewsById', relatedNewsData.id, relatedNewsData.cat_id);
				}
			});
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

		// socket returned categories array. save it to indexeddb and send it to webworker
		socket.on('categories', function(news){
				var cats = [];
				// insert categories into indexeddb
				news.categories.forEach(function(cat){
					var newCat = {id: cat.id, title: cat.title};
					db.category.put(newCat);
					cats.push(newCat);
				});

				cats = JSON.stringify(cats);
				postMessage({command: 'categories', data: cats});
		});

		socket.on('lastNews', function(news){
			// if(requestSent)
			// {
				// if(news==='')
				// {
				// 	postMessage({command: 'endPullToRefresh'});
				// }
				// else
				// {
					console.log(news);
					db.news.orderBy("news_date").reverse().limit(20).toArray().then(function (news) {
						if(news.length!==0)
						{
							postMessage({command: 'lastNews', data: JSON.stringify(news)});
						}
						else
						{
							db.news.orderBy("news_date").reverse().limit(20).toArray().then(function (news) {
								if(news.length!==0)
								{
									postMessage({command: 'lastNews', data: JSON.stringify(news)});
								}
							});
						}
					});
				// }
			// 	requestSent = false;
			// }
		});

		socket.on('moreLastNews', function(news){
			console.log(news);
			// if(requestSent)
			// {
				// if(news==='')
				// {
				// 	postMessage({command: 'endPullToRefresh'});
				// }
				// else
				// {
					db.news.orderBy("news_date").reverse().limit(20).toArray().then(function (news) {
						if(news.length!==0)
						{
							postMessage({command: 'lastNews', data: JSON.stringify(news)});
						}
						else
						{
							db.news.orderBy("news_date").reverse().limit(20).toArray().then(function (news) {
								if(news.length!==0)
								{
									postMessage({command: 'lastNews', data: JSON.stringify(news)});
								}
							});
						}
					});
				// }
			// 	requestSent = false;
			// }
		});

		socket.on('searchResult', function(news){
			if(requestSent)
			{
				postMessage({command: 'searchResult', data: JSON.stringify(news)});
				requestSent = false;
			}
		});

		// pull-to-refresh sends socket emit and moreNews sends response
		socket.on('moreNews', function(news){
			if(requestSent)
			{
				if(news.length === 0)
				{
					postMessage({command: 'endPullToRefresh'});
				}
				else
				{
					var oldestNewsId = JSON.parse(data.data);
					db.news.where('id').above(parseInt(oldestNewsId)).reverse().sortBy('news_date').then(function(news) {
						news.shift();

						// if(news.length>0)
						// {
								postMessage({command: 'moreNews', data: JSON.stringify(news)});
						// }
					});
				}
				requestSent = false;
			}
		});

		socket.on('newsItem', function(newsItem){
			if(requestSent)
			{
				// we have received news object. check if exists in the database,
				// if not, insert into indexeddb
				db.news.where('id').equals(newsItem.news_item.id).toArray().then(function (newsData) {
					// news does not exist in the database, add it
					if(newsData.length===0)
					{
						var newData = {
							id: newsItem.news_item.id,
							stripped_title: newsItem.news_item.strippedTitle,
							specialchared_title: newsItem.news_item.specialcharedTitle,
							news_date: newsItem.news_item.news_date,
							news_time: newsItem.news_item.news_time,
							news_day: newsItem.news_item.news_day,
							news_img: newsItem.news_item.news_img,
							content: newsItem.news_item.content,
							cat_title: newsItem.news_item.cat_title,
							cat_id: newsItem.news_item.cat_id,
							photos: ''
						};
						db.news.put(newData);
					}

					// send photosession request
					socket.emit('getPhotosessionById', newsItem.news_item.id);
				});

			}
		});

		socket.on('newsId', function(news){
			if(requestSent)
			{
				// update data
				var updateData = {
					id: news.news_item.id,
					stripped_title: news.news_item.strippedTitle,
					specialchared_title: news.news_item.specialcharedTitle,
					news_date: news.news_item.news_date,
					news_time: news.news_item.news_time,
					news_day: news.news_item.news_day,
					news_img: news.news_item.news_img,
					content: news.news_item.content,
					cat_title: news.news_item.cat_title,
					cat_id: news.news_item.cat_id,
					photos: ''
				};
				db.news.put(updateData);

				postMessage({command: 'news', data: JSON.stringify(news),  id: news.id});
			}
		});

		socket.on('relatedNews', function(news){
			if(requestSent)
			{
				db.news.where('cat_id').equals(parseInt(news.cat_id)).reverse().limit(10).sortBy('news_date').then(function(news) {
					news.shift();

					postMessage({command: 'relatedNews', data: JSON.stringify({news: news})});
					requestSent = false;
				});
			}
		});

		socket.on('moreRelatedNews', function(news){
			if(requestSent)
			{
				console.log(news);
				// db.news.where('cat_id').equals(parseInt(oldestRelatedNewsCatId)).limit(20).reverse().sortBy('news_date').then(function(news) {
				// 	news.shift();
				//
				// 	if(news.length>0)
				// 	{
				// 		var newArray = [];
				// 		news.forEach(function(newsItem){
				// 			if(newsItem.id > parseInt(oldestRelatedNewsId) && newsItem.length < 10)
				// 				newArray.push(newsItem);
				// 		});
				//
				// 		if(newArray.length>0)
				// 		{
				// 			console.log(newArray);
				// 			// postMessage({command: 'moreNews', data: JSON.stringify(news)});
				// 		}
				// 		else
				// 		{
				// 			console.log('related news data not more than 10');
				// 			socket.emit('getMoreRelatedNewsById', data.id, data.catId, data.pageNo);
				// 		}
				// 	}
				// 	else
				// 	{
				// 		console.log('no more related news data');
				// 		requestSent = true;
				// 		socket.emit('getMoreRelatedNewsById', data.id, data.catId, data.pageNo);
				// 	}
				// });
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

		// photosession object returned by socket. update news id and add the photos
		socket.on('photosession', function(photos){
				// if response is not empty, update news id and add the photos
				if(photos.photos.length > 0)
				{
					// update data and add photos
					db.news.where('id').equals(JSON.parse(photos.id)).toArray().then(function (newsData) {
						var updateData = {
							photos: photos.photos
						};
						db.news.update(JSON.parse(photos.id), updateData);
					});
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
		var htmlCategories = categoriesTemplate({categories: JSON.parse(data.data)});

		$$('.categories ul').html(htmlCategories);
	}

	// end pull-to-refresh-content event
	if(data.command == 'endPullToRefresh')
	{
		myApp.pullToRefreshDone();
	}

	// show categor news data
	if(data.command == 'categoryNews')
	{
		var catNews = JSON.parse(data.data);

		myApp.hideIndicator();

		var htmlCatNews = categoryNewsTemplate({news: catNews});

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
		var newsData = JSON.parse(data.data);

		html = categoryNewsTemplate({news: newsData});
		$$('.index .content-block').prepend(html);

		// $$('.index .content-block').prepend(html);
		myApp.oldestId = $$('.content-block a:last-child').data('newsid');

		myApp.hideIndicator();
		myApp.pullToRefreshDone();
	}

	// webworker sent the app 'moreNews' command
	if(data.command == 'moreNews')
	{
		var moreNews = JSON.parse(data.data);

		// compile template data
		htmlPreviousNews = categoryNewsTemplate({news: moreNews});

		// Append new items
		$$('.index .content-block').append(htmlPreviousNews);
	}

	if(data.command == 'news')
	{
		var news = JSON.parse(data.data);
		var htmlNews = newsTemplate(news[0]);

		$$('.news_inner .news').html(htmlNews);
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

var isUpdate = window.localStorage.getItem('isUpdate');

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
}

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
			// show preloader till we will be getting data from the server
			myApp.showIndicator();

			var webworkerArray= [];
			webworkerArray.command = 'getCats';
			worker.postMessage(webworkerArray);
	}

	// news page is called, load the news from local database
	if(page.name === 'newsInner')
	{
		var newsId = page.query.id;
		var catId = page.query.cat_id;

		// send get request to the server
		var newsWebworkerArray = [];
		newsWebworkerArray.command = 'getNewsById';
		newsWebworkerArray.data = newsId;
		worker.postMessage(newsWebworkerArray);

		// get view count for this id
		var newsViewCountWebworkerArray = [];
		newsViewCountWebworkerArray.command = 'getViewCountById';
		newsViewCountWebworkerArray.data = newsId;
		worker.postMessage(newsViewCountWebworkerArray);

		// get relatedNews
		var relatedNewstWebworkerArray = [];
		relatedNewstWebworkerArray.command = 'getRelatedNewsById';
		relatedNewstWebworkerArray.data = JSON.stringify({id: newsId, cat_id: catId});
		worker.postMessage(relatedNewstWebworkerArray);

		// add GA tracking
		// window.analytics.trackView(htmlNews.title);
	}

	// show category news
	if(page.name === 'cat')
	{
		$$('.categories a').addClass('second');

		var innerPageCatId = page.query.id;

		// show preloader till we will be getting data from the server
		myApp.showIndicator();

		var catData = [];
		catData.id = innerPageCatId;
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
		var catId = page.query.cat_id;

		// send get request to the server
		var newsWebworkerArray = [];
		newsWebworkerArray.command = 'getNewsById';
		newsWebworkerArray.data = newsId;
		worker.postMessage(newsWebworkerArray);

		// get view count for this id
		var newsViewCountWebworkerArray = [];
		newsViewCountWebworkerArray.command = 'getViewCountById';
		newsViewCountWebworkerArray.data = newsId;
		worker.postMessage(newsViewCountWebworkerArray);

		// get relatedNews
		var relatedNewstWebworkerArray = [];
		relatedNewstWebworkerArray.command = 'getRelatedNewsById';
		relatedNewstWebworkerArray.data = JSON.stringify({id: newsId, cat_id: catId});
		worker.postMessage(relatedNewstWebworkerArray);

		// add GA tracking
		// window.analytics.trackView(htmlNews.title);
	}

	// show category news
	if(page.name === 'cat')
	{
		$$('.categories a').addClass('second');

		var innerPageCatId = page.query.id;

		// show preloader till we will be getting data from the server
		myApp.showIndicator();

		var catData = [];
		catData.id = innerPageCatId;
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
	// send last news request to worker
	var webworkerArray= [];
	webworkerArray.command = 'getCats';
	worker.postMessage(webworkerArray);
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
myApp.maxItems = 1000;

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

	// if not undefined, we are on news page. we should load more related news data
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

		// the function is called for search page
		if(indexOrNewsPage === 'search')
		{
			console.log('search');
			var mySearchbar = $$('.searchbar')[0].f7Searchbar;
			var webworkerArray= [];
			webworkerArray.command = 'search';
			webworkerArray.query=mySearchbar.query;
			webworkerArray.pageNo = $$('.searchbar-found a.card').length;
			worker.postMessage(webworkerArray);
		}

		// the function is called for news page
		if(indexOrNewsPage === 'news')
		{
			var moreRelatedNewsWebworkerArray= [];
			moreRelatedNewsWebworkerArray.command = 'getMoreRelatedNews';
			moreRelatedNewsWebworkerArray.data = myApp.oldestId;
			moreRelatedNewsWebworkerArray.id = $$('.news .content-block-title').data('id');
			moreRelatedNewsWebworkerArray.catId = $$('.news .content-block-title').data('catid');
			moreRelatedNewsWebworkerArray.pageNo = $$('.others a.card').length;
			worker.postMessage(moreRelatedNewsWebworkerArray);
		}

		// the function is called for index page
		if(indexOrNewsPage === 'index')
		{
			console.log('index');
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
		var lastNewsId = $$('.content-block a:first-child').data('newsid');
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
