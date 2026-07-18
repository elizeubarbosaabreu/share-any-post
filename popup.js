var currentPost = null;
var generatedText = '';
var allImages = [];
var imgIndex = 0;
var selectedRatio = '9:16';

var RATIOS = {
  '9:16': { w: 1080, h: 1920 },
  '4:5':  { w: 1080, h: 1350 },
  '1:1':  { w: 1080, h: 1080 },
};

function showStatus(msg, isError) {
  var el = document.getElementById('status');
  el.textContent = msg;
  el.className = isError ? 'status error' : 'status';
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function updateImgNav() {
  var nav = document.getElementById('imgNav');
  var thumb = document.getElementById('imgThumb');
  var prev = document.getElementById('imgPrev');
  var next = document.getElementById('imgNext');
  var counter = document.getElementById('imgCounter');

  if (allImages.length > 1) {
    nav.style.display = 'block';
    thumb.src = allImages[imgIndex];
    thumb.onerror = function() { this.style.display = 'none'; };
    thumb.style.display = 'block';
    prev.style.display = imgIndex > 0 ? 'block' : 'none';
    next.style.display = imgIndex < allImages.length - 1 ? 'block' : 'none';
    counter.style.display = 'block';
    counter.textContent = (imgIndex + 1) + ' / ' + allImages.length;
    currentPost.img = allImages[imgIndex];
    currentPost.imgDataUrl = '';
    downloadCurrentImg();
  } else if (allImages.length === 1) {
    nav.style.display = 'block';
    thumb.src = allImages[0];
    thumb.style.display = 'block';
    prev.style.display = 'none';
    next.style.display = 'none';
    counter.style.display = 'none';
  } else {
    nav.style.display = 'none';
  }
}

function downloadCurrentImg() {
  if (!currentPost || !currentPost.img) return;
  showStatus('Baixando imagem...');
  chrome.runtime.sendMessage({ action: 'fetchImage', url: currentPost.img }, function(res) {
    if (res && res.dataUrl) {
      currentPost.imgDataUrl = res.dataUrl;
    }
  });
}

function extractPost() {
  showStatus('Extraindo postagem...');
  document.getElementById('generateBtn').disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tab = tabs[0];

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }, function() {
      if (chrome.runtime.lastError) {
        showStatus('Erro ao injetar script', true);
        return;
      }
      chrome.tabs.sendMessage(tab.id, { action: 'extract' }, function(response) {
        if (chrome.runtime.lastError || !response) {
          showStatus('Sem resposta. Recarregue a pagina.', true);
          return;
        }
        currentPost = response;
        allImages = response.allImages || (response.img ? [response.img] : []);
        imgIndex = 0;
        showPost(response);
        if (allImages.length > 0) {
          updateImgNav();
          downloadCurrentImg();
        }
      });
    });
  });
}

function showPost(data) {
  var card = document.getElementById('postCard');
  var nav = document.getElementById('imgNav');
  card.innerHTML = '';
  card.appendChild(nav);

  var html = '<div class="post-info">';
  if (data.title) {
    html += '<div class="post-title">' + escHtml(data.title) + '</div>';
  }
  html += '<div class="post-url">' + escHtml(data.link) + '</div>';
  html += '</div>';

  card.insertAdjacentHTML('beforeend', html);
  card.style.display = 'block';
  document.getElementById('generateBtn').style.display = 'block';
  document.getElementById('generateBtn').disabled = false;
  showStatus('Postagem extraida. Clique para gerar story.');
}

function doGenerate() {
  if (!currentPost) {
    showStatus('Nenhuma postagem extraida', true);
    return;
  }

  var generateBtn = document.getElementById('generateBtn');
  var preview = document.getElementById('preview');
  var canvas = document.getElementById('canvas');

  generateBtn.disabled = true;
  showStatus('Gerando story...');

  try {
    var dims = RATIOS[selectedRatio];
    var storyWidth = dims.w;
    var storyHeight = dims.h;
    var padding = Math.round(storyWidth * 0.055);

    canvas.width = storyWidth;
    canvas.height = storyHeight;
    var ctx = canvas.getContext('2d');

    var gradient = ctx.createLinearGradient(0, 0, 0, storyHeight);
    gradient.addColorStop(0, '#0f0f1a');
    gradient.addColorStop(0.5, '#1a1a2e');
    gradient.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, storyWidth, storyHeight);

    var imgSrc = currentPost.imgDataUrl ? currentPost.imgDataUrl : '';

    if (imgSrc) {
      var img = new Image();
      img.onload = function() {
        try {
          var imgDims = drawImageOnCanvas(ctx, img, storyWidth, storyHeight, padding);
          drawTitle(ctx, currentPost, storyWidth, storyHeight, padding, imgDims);
          drawButtonSpace(ctx, currentPost, storyWidth, storyHeight, padding);
          finishStory(preview, generateBtn);
        } catch (e) {
          showStatus('Erro ao desenhar: ' + e.message, true);
          generateBtn.disabled = false;
        }
      };
      img.onerror = function() {
        try {
          drawTitle(ctx, currentPost, storyWidth, storyHeight, padding);
          drawButtonSpace(ctx, currentPost, storyWidth, storyHeight, padding);
          finishStory(preview, generateBtn);
        } catch (e) {
          showStatus('Erro: ' + e.message, true);
          generateBtn.disabled = false;
        }
      };
      img.src = imgSrc;
    } else {
      drawTitle(ctx, currentPost, storyWidth, storyHeight, padding);
      drawButtonSpace(ctx, currentPost, storyWidth, storyHeight, padding);
      finishStory(preview, generateBtn);
    }
  } catch (err) {
    showStatus('Erro: ' + err.message, true);
    generateBtn.disabled = false;
  }
}

function drawImageOnCanvas(ctx, img, w, h, pad) {
  var imgW = img.naturalWidth || img.width;
  var imgH = img.naturalHeight || img.height;
  var maxW = w * 0.9;
  var maxH = h * 0.4;
  var scale = Math.min(maxW / imgW, maxH / imgH, 1);
  imgW *= scale;
  imgH *= scale;
  var imgX = (w - imgW) / 2;
  var imgY = h * 0.15;
  var radius = Math.round(w * 0.02);

  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = Math.round(w * 0.028);
  ctx.shadowOffsetY = Math.round(h * 0.005);
  roundRect(ctx, imgX - 10, imgY - 10, imgW + 20, imgH + 20, radius + 10);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.drawImage(img, imgX, imgY, imgW, imgH);
  return { w: imgW, h: imgH, y: imgY };
}

function drawTitle(ctx, post, w, h, pad, imgDims) {
  var imgBottom = imgDims ? (imgDims.y + imgDims.h) : h * 0.55;
  var textY = imgBottom + Math.round(h * 0.03);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold ' + Math.round(w * 0.044) + 'px Arial, sans-serif';
  ctx.textAlign = 'center';
  wrapText(ctx, post.title || 'Post', w / 2, textY, w - pad * 2, Math.round(w * 0.054));
}

function drawButtonSpace(ctx, post, w, h, pad) {
  var boxW = w - pad * 2;
  var boxH = 100;
  var boxX = pad;
  var boxY = h - boxH - pad - 40;

  ctx.shadowColor = 'rgba(124, 58, 237, 0.4)';
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 5;
  roundRect(ctx, boxX, boxY, boxW, boxH, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();

  ctx.shadowColor = 'transparent';

  ctx.strokeStyle = 'rgba(124, 58, 237, 0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, boxX, boxY, boxW, boxH, 20);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Toque para acessar o link', w / 2, boxY + boxH / 2 + 8);
}

function finishStory(preview, generateBtn) {
  var canvas = document.getElementById('canvas');
  generatedText = (currentPost.title || 'Post');
  generatedText += '\n\n' + currentPost.link;

  preview.src = canvas.toDataURL('image/png');
  preview.style.display = 'block';
  document.getElementById('downloadBtn').style.display = 'block';
  document.getElementById('copyBtn').style.display = 'block';
  generateBtn.disabled = false;
  showStatus('Story gerado!');
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  var words = text.split(' ');
  var line = '';
  var currentY = y;
  for (var i = 0; i < words.length; i++) {
    var testLine = line + words[i] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[i] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

document.getElementById('generateBtn').addEventListener('click', doGenerate);

document.querySelectorAll('.btn-aspect').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.btn-aspect').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    selectedRatio = btn.getAttribute('data-ratio');
  });
});

document.getElementById('downloadBtn').addEventListener('click', function() {
  var link = document.createElement('a');
  link.download = 'story-' + Date.now() + '.png';
  link.href = document.getElementById('canvas').toDataURL('image/png');
  link.click();
});
document.getElementById('copyBtn').addEventListener('click', function() {
  navigator.clipboard.writeText(generatedText).then(function() {
    showStatus('Texto copiado!');
  });
});
document.getElementById('imgPrev').addEventListener('click', function() {
  if (imgIndex > 0) { imgIndex--; updateImgNav(); }
});
document.getElementById('imgNext').addEventListener('click', function() {
  if (imgIndex < allImages.length - 1) { imgIndex++; updateImgNav(); }
});

extractPost();