function extractPost() {
  var title = '';
  var img = '';
  var allImages = [];
  var link = window.location.href.split('#')[0];
  var description = '';

  var ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) title = ogTitle.getAttribute('content');

  if (!title) {
    var twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) title = twitterTitle.getAttribute('content');
  }

  if (!title) {
    var h1 = document.querySelector('h1');
    if (h1) title = h1.textContent.trim();
  }

  if (!title) {
    var titleTag = document.querySelector('title');
    if (titleTag) title = titleTag.textContent.trim();
  }

  var seen = {};
  function addImg(src) {
    if (!src || src.startsWith('data:')) return;
    if (!src.startsWith('http')) {
      try { src = new URL(src, window.location.origin).href; } catch(e) { return; }
    }
    if (!seen[src]) { seen[src] = true; allImages.push(src); }
  }

  var contentImgs = document.querySelectorAll('article img, .post img, .content img, main img, .entry-content img, .media img');
  contentImgs.forEach(function(el) {
    var area = (el.naturalWidth || el.width) * (el.naturalHeight || el.height);
    if (area > 10000) addImg(el.src);
  });

  var heroImg = document.querySelector('img[class*="hero"], img[class*="featured"], img[class*="main"], img[class*="cover"]');
  if (heroImg) addImg(heroImg.src);

  var ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg) addImg(ogImg.getAttribute('content'));

  var twitterImg = document.querySelector('meta[name="twitter:image"]');
  if (twitterImg) addImg(twitterImg.getAttribute('content'));

  var allPageImgs = document.querySelectorAll('img');
  allPageImgs.forEach(function(el) {
    var w = el.naturalWidth || el.width;
    var h = el.naturalHeight || el.height;
    if (w > 200 && h > 200) addImg(el.src);
  });

  if (allImages.length > 0) img = allImages[0];

  var ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) description = ogDesc.getAttribute('content');

  if (!description) {
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) description = metaDesc.getAttribute('content');
  }

  return {
    title: title || document.title || 'Post',
    img: img || '',
    allImages: allImages,
    link: link,
    description: description || ''
  };
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'extract') {
    var data = extractPost();
    data.imgDataUrl = '';
    sendResponse(data);
  }
});