chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'fetchImage' && request.url) {
    fetch(request.url)
      .then(function(res) {
        if (!res.ok) throw new Error('fail');
        return res.blob();
      })
      .then(function(blob) {
        var reader = new FileReader();
        reader.onloadend = function() { sendResponse({ dataUrl: reader.result }); };
        reader.readAsDataURL(blob);
      })
      .catch(function() { sendResponse({ dataUrl: '' }); });
    return true;
  }
});