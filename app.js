let pendingBackgroundData = null;

// Lettura e applicazione dei parametri salvati per lo sfondo
function applySavedBackground() {
  const bgData = localStorage.getItem('reddit_custom_bg');
  const isBlurred = localStorage.getItem('reddit_bg_blur_enabled') !== 'false';
  const blurAmount = localStorage.getItem('reddit_bg_blur_px') || '8';
  const overlayOpacity = localStorage.getItem('reddit_bg_overlay_opacity') || '70';

  const overlay = document.getElementById('bg-overlay');
  if (bgData) {
    document.body.style.backgroundImage = `url(${bgData})`;
    if (overlay) {
      overlay.style.backdropFilter = isBlurred ? `blur(${blurAmount}px)` : 'none';
      overlay.style.backgroundColor = `rgba(13, 17, 23, ${overlayOpacity / 100})`;
    }
  } else {
    document.body.style.backgroundImage = '';
  }
}

// Aggiorna la navbar se l'utente è loggato
function updateAuthUI() {
  const loggedUser = localStorage.getItem('reddit_logged_user');
  const navActions = document.querySelector('.nav-actions');
  if (!navActions) return;

  const loginBtn = navActions.querySelector('.btn-login');
  if (loggedUser && loginBtn) {
    loginBtn.outerHTML = `
      <span style="font-size: 0.88rem; color: var(--text-main); font-weight: 600; padding: 0 6px;">👤 u/${loggedUser}</span>
      <button id="logout-btn" class="btn btn-danger" style="padding: 6px 12px; font-size: 0.82rem;">Esci</button>
    `;
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      localStorage.removeItem('reddit_logged_user');
      location.reload();
    });
  }
}

// Carica e mostra i post salvati in db.json tramite api.php
async function loadDynamicPosts() {
  const feedContainer = document.querySelector('main.feed');
  if (!feedContainer) return;

  // Rileva il canale corrente dal nome del file HTML
  const path = window.location.pathname.split('/').pop() || 'index.html';
  const currentChannel = path.replace('.html', '');

  try {
    const res = await fetch('api.php?action=get_posts');
    if (!res.ok) return;
    const posts = await res.json();

    if (!Array.isArray(posts)) return;

    // Filtra i post per canale se non siamo nella home
    const filteredPosts = (currentChannel === 'index' || currentChannel === '')
      ? posts
      : posts.filter(p => p.channel === currentChannel);

    // Inserisce i post dinamici subito dopo l'intestazione del feed / channel-hero
    const referenceNode = feedContainer.querySelector('.channel-hero') || feedContainer.firstElementChild;

    // Crea un contenitore dedicato per i post da JSON se non esiste
    let dynamicContainer = document.getElementById('dynamic-posts-container');
    if (!dynamicContainer) {
      dynamicContainer = document.createElement('div');
      dynamicContainer.id = 'dynamic-posts-container';
      dynamicContainer.style.display = 'flex';
      dynamicContainer.style.flexDirection = 'column';
      dynamicContainer.style.gap = '16px';
      if (referenceNode && referenceNode.nextSibling) {
        feedContainer.insertBefore(dynamicContainer, referenceNode.nextSibling);
      } else {
        feedContainer.appendChild(dynamicContainer);
      }
    }

    const currentUser = localStorage.getItem('reddit_logged_user');
    const currentAuthorTag = currentUser ? `u/${currentUser}` : null;

    dynamicContainer.innerHTML = filteredPosts.map(post => {
      const isOwner = currentAuthorTag && post.author === currentAuthorTag;
      const deleteButtonHTML = isOwner
        ? `<div class="action-pill delete-post-btn" data-id="${post.id}" style="color: #f85149; border: 1px solid rgba(248, 81, 73, 0.3);">🗑️ Elimina</div>`
        : '';

      return `
        <article class="post-card">
          <div class="vote-sidebar">
            <button class="vote-btn up" title="Upvote">▲</button>
            <span class="vote-count">${post.votes}</span>
            <button class="vote-btn down" title="Downvote">▼</button>
          </div>
          <div class="post-main">
            <div class="post-meta">
              <a href="${post.channel}.html" class="post-channel-tag">r/${post.channel}</a>
              <span>•</span>
              <span>Postato da ${post.author}</span>
              <span>•</span>
              <span>${post.time}</span>
            </div>
            <h2 class="post-title">${escapeHTML(post.title)}</h2>
            <p class="post-content">${escapeHTML(post.content)}</p>
            <div class="post-footer">
              <div class="action-pill">💬 ${post.comments} Commenti</div>
              <div class="action-pill">🔗 Condividi</div>
              <div class="action-pill">🔖 Salva</div>
              ${deleteButtonHTML}
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Collega il click sui pulsanti Elimina
    dynamicContainer.querySelectorAll('.delete-post-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Vuoi davvero eliminare questo post?')) return;
        const postId = btn.dataset.id;

        try {
          const res = await fetch('api.php?action=delete_post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: postId, author: currentAuthorTag })
          });
          const data = await res.json();
          if (data.success) {
            await loadDynamicPosts();
          } else {
            alert(data.message);
          }
        } catch (err) {
          alert('Errore durante l\'eliminazione del post.');
        }
      });
    });

    bindVoteButtons(dynamicContainer);
  } catch (err) {
    console.warn('Impossibile caricare i post dal server PHP (assicurati di usare XAMPP/Apache):', err);
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function bindVoteButtons(root = document) {
  root.querySelectorAll('.vote-btn').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      const parent = btn.closest('.vote-sidebar');
      const counter = parent.querySelector('.vote-count');
      let count = parseInt(counter.textContent, 10);
      const isUp = btn.classList.contains('up');
      const upBtn = parent.querySelector('.vote-btn.up');
      const downBtn = parent.querySelector('.vote-btn.down');

      if (isUp) {
        if (upBtn.classList.contains('active')) {
          upBtn.classList.remove('active');
          counter.textContent = count - 1;
        } else {
          if (downBtn.classList.contains('active')) {
            downBtn.classList.remove('active');
            count += 1;
          }
          upBtn.classList.add('active');
          counter.textContent = count + 1;
        }
      } else {
        if (downBtn.classList.contains('active')) {
          downBtn.classList.remove('active');
          counter.textContent = count + 1;
        } else {
          if (upBtn.classList.contains('active')) {
            upBtn.classList.remove('active');
            count -= 1;
          }
          downBtn.classList.add('active');
          counter.textContent = count - 1;
        }
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applySavedBackground();
  updateAuthUI();
  bindVoteButtons(document);
  loadDynamicPosts();

  // Search bar expand & search filtering
  const searchInput = document.getElementById('search-box');
  const searchWrapper = document.getElementById('search-container');
  if (searchInput && searchWrapper) {
    searchInput.addEventListener('focus', () => searchWrapper.classList.add('expanded'));
    searchInput.addEventListener('blur', () => {
      if (!searchInput.value.trim()) searchWrapper.classList.remove('expanded');
    });
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.post-card').forEach(card => {
        const title = card.querySelector('.post-title')?.textContent.toLowerCase() || '';
        const body = card.querySelector('.post-content')?.textContent.toLowerCase() || '';
        const ch = card.querySelector('.post-channel-tag')?.textContent.toLowerCase() || '';
        if (title.includes(q) || body.includes(q) || ch.includes(q)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }

  // Modale Creazione Post
  const openPostBtn = document.getElementById('open-post-modal');
  const postModal = document.getElementById('post-modal');
  const closePostBtn = document.getElementById('close-post-modal');

  if (openPostBtn && postModal) {
    openPostBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const loggedUser = localStorage.getItem('reddit_logged_user');
      if (!loggedUser) {
        alert('Devi effettuare il login per creare un post!');
        window.location.href = 'login.html';
        return;
      }
      const path = window.location.pathname.split('/').pop() || 'index.html';
      const currentChannel = path.replace('.html', '');
      const selectEl = document.getElementById('post-channel-select');
      if (selectEl && ['tecnologia', 'programmazione', 'gaming', 'domande', 'scienza'].includes(currentChannel)) {
        selectEl.value = currentChannel;
      }
      postModal.classList.add('open');
    });
  }

  if (closePostBtn && postModal) {
    closePostBtn.addEventListener('click', () => postModal.classList.remove('open'));
    postModal.addEventListener('click', (e) => {
      if (e.target === postModal) postModal.classList.remove('open');
    });
  }

  document.getElementById('create-post-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const channel = document.getElementById('post-channel-select').value;
    const title = document.getElementById('post-title-input').value;
    const content = document.getElementById('post-content-input').value;
    const author = 'u/' + (localStorage.getItem('reddit_logged_user') || 'ospite');

    try {
      const res = await fetch('api.php?action=create_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, title, content, author })
      });
      const data = await res.json();
      if (data.success) {
        postModal.classList.remove('open');
        document.getElementById('create-post-form').reset();
        await loadDynamicPosts();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Errore di comunicazione con il server. Verifica che XAMPP/Apache sia attivo.');
    }
  });

  // Background modal handlers & preview controls
  const openBgBtn = document.getElementById('open-bg-modal');
  const closeBgBtn = document.getElementById('close-bg-modal');
  const bgModal = document.getElementById('bg-modal');
  const bgInput = document.getElementById('bg-file-input');
  const resetBgBtn = document.getElementById('reset-bg-btn');
  const applyBgBtn = document.getElementById('apply-bg-btn');
  const previewBox = document.getElementById('bg-preview-box');
  const previewImg = document.getElementById('bg-preview-img');
  const previewOverlay = document.getElementById('bg-preview-overlay');
  const previewFileName = document.getElementById('preview-file-name');

  const blurCheck = document.getElementById('blur-toggle');
  const blurSlider = document.getElementById('blur-slider');
  const blurValDisplay = document.getElementById('blur-val-display');
  const opacitySlider = document.getElementById('opacity-slider');
  const opacityValDisplay = document.getElementById('opacity-val-display');

  function updatePreviewEffects() {
    if (!previewImg) return;
    const isBlurred = blurCheck ? blurCheck.checked : true;
    const blurPx = blurSlider ? blurSlider.value : 8;
    const opacityVal = opacitySlider ? opacitySlider.value : 70;

    if (blurValDisplay) blurValDisplay.textContent = `${blurPx}px`;
    if (opacityValDisplay) opacityValDisplay.textContent = `${opacityVal}%`;

    previewImg.style.filter = isBlurred ? `blur(${blurPx}px)` : 'none';

    if (previewOverlay) {
      previewOverlay.style.backgroundColor = `rgba(13, 17, 23, ${opacityVal / 100})`;
    }

    if (blurSlider) {
      blurSlider.disabled = !isBlurred;
      blurSlider.style.opacity = isBlurred ? '1' : '0.4';
    }
  }

  if (blurCheck) blurCheck.addEventListener('change', updatePreviewEffects);
  if (blurSlider) blurSlider.addEventListener('input', updatePreviewEffects);
  if (opacitySlider) opacitySlider.addEventListener('input', updatePreviewEffects);

  if (openBgBtn && bgModal) {
    openBgBtn.addEventListener('click', () => {
      bgModal.classList.add('open');
      const currentBg = localStorage.getItem('reddit_custom_bg');

      const savedBlurred = localStorage.getItem('reddit_bg_blur_enabled') !== 'false';
      const savedBlurPx = localStorage.getItem('reddit_bg_blur_px') || '8';
      const savedOpacity = localStorage.getItem('reddit_bg_overlay_opacity') || '70';

      if (blurCheck) blurCheck.checked = savedBlurred;
      if (blurSlider) blurSlider.value = savedBlurPx;
      if (opacitySlider) opacitySlider.value = savedOpacity;

      if (currentBg && !pendingBackgroundData) {
        previewImg.src = currentBg;
        if (previewFileName) previewFileName.textContent = "Sfondo attuale";
        previewBox.classList.add('has-preview');
        updatePreviewEffects();
        if (applyBgBtn) {
          applyBgBtn.disabled = false;
          applyBgBtn.textContent = 'Aggiorna Effetti';
        }
      } else {
        updatePreviewEffects();
      }
    });
  }

  function closeModal() {
    if (bgModal) bgModal.classList.remove('open');
    pendingBackgroundData = null;
    if (bgInput) bgInput.value = '';
    if (previewBox) previewBox.classList.remove('has-preview');
    if (applyBgBtn) applyBgBtn.disabled = true;
  }

  if (closeBgBtn) closeBgBtn.addEventListener('click', closeModal);
  if (bgModal) {
    bgModal.addEventListener('click', (e) => {
      if (e.target === bgModal) closeModal();
    });
  }

  if (bgInput) {
    bgInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) {
          alert('Seleziona un formato immagine valido (PNG, JPG, WebP).');
          return;
        }
        const reader = new FileReader();
        reader.onload = function(evt) {
          pendingBackgroundData = evt.target.result;
          if (previewImg && previewBox) {
            previewImg.src = pendingBackgroundData;
            if (previewFileName) previewFileName.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            previewBox.classList.add('has-preview');
            updatePreviewEffects();
          }
          if (applyBgBtn) {
            applyBgBtn.disabled = false;
            applyBgBtn.textContent = 'Applica Sfondo';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (applyBgBtn) {
    applyBgBtn.addEventListener('click', () => {
      const currentBg = localStorage.getItem('reddit_custom_bg');
      const bgToSave = pendingBackgroundData || currentBg;

      if (bgToSave) {
        try {
          localStorage.setItem('reddit_custom_bg', bgToSave);
          localStorage.setItem('reddit_bg_blur_enabled', blurCheck ? blurCheck.checked : 'true');
          localStorage.setItem('reddit_bg_blur_px', blurSlider ? blurSlider.value : '8');
          localStorage.setItem('reddit_bg_overlay_opacity', opacitySlider ? opacitySlider.value : '70');

          applySavedBackground();
          closeModal();
        } catch(err) {
          alert('File troppo grande per essere salvato in memoria locale. Prova con una foto più leggera (< 4MB).');
        }
      }
    });
  }

  if (resetBgBtn) {
    resetBgBtn.addEventListener('click', () => {
      localStorage.removeItem('reddit_custom_bg');
      localStorage.removeItem('reddit_bg_blur_enabled');
      localStorage.removeItem('reddit_bg_blur_px');
      localStorage.removeItem('reddit_bg_overlay_opacity');
      document.body.style.backgroundImage = '';
      closeModal();
    });
  }
});