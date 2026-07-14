function extractPost() {
  var title = '';
  var img = '';
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

  var ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg) img = ogImg.getAttribute('content');

  if (!img) {
    var twitterImg = document.querySelector('meta[name="twitter:image"]');
    if (twitterImg) img = twitterImg.getAttribute('content');
  }

  if (!img) {
    var mainImg = document.querySelector('article img, .post img, .content img, main img');
    if (mainImg) img = mainImg.src;
  }

  if (!img) {
    var largeImg = document.querySelector('img[width], img[class*="hero"], img[class*="featured"]');
    if (largeImg) img = largeImg.src;
  }

  if (!img) {
    var firstImg = document.querySelector('img');
    if (firstImg && firstImg.naturalWidth > 200) img = firstImg.src;
  }

  var ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) description = ogDesc.getAttribute('content');

  if (!description) {
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) description = metaDesc.getAttribute('content');
  }

  return {
    title: title || document.title || 'Post',
    img: img || '',
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