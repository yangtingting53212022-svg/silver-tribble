const grid = document.querySelector('#grid');
const count = document.querySelector('#count');
const viewer = document.querySelector('#viewer');
const stage = document.querySelector('#stage');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const filters = document.querySelectorAll('[data-filter]');
let visibleWorks = [];
let activeIndex = 0;
let activeFilter = 'all';
const designerLinks = [...document.querySelectorAll('[data-designer]')];
const selectedDesigner = new URLSearchParams(location.search).get('designer');
const designerLink = designerLinks.find(link => link.dataset.designer === selectedDesigner) || designerLinks[0];
const designer = designerLink.dataset.designer;
const designerName = designerLink.textContent;
const defaultDesigner = 'yang-tingting';
designerLink.setAttribute('aria-current', 'page');
document.querySelector('#designer-title').textContent = designerName + '的作品';
document.title = designerName + ' · ' + document.title;
const originalWorks = [];
const cover = document.querySelector('.cover');
const showCoverFallback = () => cover.closest('.hero').classList.add('cover-missing');
cover.addEventListener('error', showCoverFallback);
if (cover.complete && !cover.naturalWidth) showCoverFallback();
let collection = [...originalWorks];
let database;
let editing;
const editor = document.querySelector('#editor');
const form = document.querySelector('#edit-form');
const fileInput = document.querySelector('#file');
const nameInput = document.querySelector('#name');
const dateInput = document.querySelector('#work-date');
const monthSelect = document.querySelector('#month');
const editError = document.querySelector('#edit-error');
const uploadButton = document.querySelector('#upload');
const renameButton = document.querySelector('#rename');
const shared = document.documentElement.hasAttribute('data-shared');

function createMedia(work, preview) {
  const media = document.createElement(work.video ? 'video' : 'img');
  media.src = work.url || 'media/' + work.file;
  if (work.video) {
    media.playsInline = true;
    media.controls = !preview;
    media.preload = preview ? 'metadata' : 'auto';
    if (preview) {
      media.muted = true;
      media.loop = true;
      media.setAttribute('aria-hidden', 'true');
    }
  } else {
    media.alt = preview ? '' : work.name;
    if (preview) media.loading = 'lazy';
  }
  return media;
}

function showWork(index) {
  activeIndex = (index + visibleWorks.length) % visibleWorks.length;
  const work = visibleWorks[activeIndex];
  document.querySelector('#work-title').textContent = work.name;
  document.querySelector('#position').textContent = (activeIndex + 1) + ' / ' + visibleWorks.length;
  const media = createMedia(work, false);
  stage.replaceChildren(media);
  if (!viewer.open) viewer.showModal();
  if (work.video && !reducedMotion.matches) media.play().catch(() => {});
}

function render(filter) {
  activeFilter = filter;
  const previousMonth = monthSelect.value;
  const months = [...new Set(collection.map(work => work.date?.slice(0, 7)).filter(Boolean))].sort().reverse();
  const options = [new Option('全部时间', 'all'), ...months.map(month => {
    const [year, number] = month.split('-');
    return new Option(year + ' 年 ' + Number(number) + ' 月', month);
  })];
  if (collection.some(work => !work.date)) options.push(new Option('未标注日期', 'undated'));
  monthSelect.replaceChildren(...options);
  monthSelect.value = options.some(option => option.value === previousMonth) ? previousMonth : 'all';
  visibleWorks = collection.filter(work => {
    const matchesType = filter === 'all' || work.video === (filter === 'video');
    const month = work.date?.slice(0, 7) || 'undated';
    return matchesType && (monthSelect.value === 'all' || month === monthSelect.value);
  });
  count.textContent = visibleWorks.length + ' 件作品';
  const empty = document.querySelector('#empty');
  empty.hidden = visibleWorks.length > 0;
  empty.textContent = collection.length ? '当前筛选条件下暂无作品。' : designerName + '还没有上传作品。';
  grid.replaceChildren(...visibleWorks.map((work, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.style.setProperty('--delay', Math.min(index, 7) * 35 + 'ms');
    card.innerHTML = '<span class="thumb"></span><span class="meta"><span></span><small></small></span>';
    const media = createMedia(work, true);
    const thumb = card.querySelector('.thumb');
    thumb.append(media);
    card.querySelector('.meta span').textContent = work.name;
    const category = work.video ? '动态影像' : '平面设计';
    card.querySelector('small').textContent = work.date ? category + ' · ' + work.date : category;
    if (work.video) {
      const play = document.createElement('span');
      play.className = 'play';
      play.textContent = '▶';
      play.setAttribute('aria-hidden', 'true');
      thumb.append(play);
      card.addEventListener('pointerenter', event => {
        if (event.pointerType === 'mouse' && !reducedMotion.matches) media.play().catch(() => {});
      });
      card.addEventListener('pointerleave', () => media.pause());
    }
    card.addEventListener('click', () => {
      if (work.video) media.pause();
      showWork(index);
    });
    return card;
  }));
}

filters.forEach(button => button.addEventListener('click', () => {
  filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  render(button.dataset.filter);
}));
monthSelect.onchange = () => render(activeFilter);
document.querySelector('#close').onclick = () => viewer.close();
document.querySelector('#prev').onclick = () => showWork(activeIndex - 1);
document.querySelector('#next').onclick = () => showWork(activeIndex + 1);
viewer.addEventListener('close', () => stage.replaceChildren());
viewer.addEventListener('click', event => {
  if (event.target === viewer) viewer.close();
});
viewer.addEventListener('keydown', event => {
  if (event.target instanceof HTMLVideoElement) return;
  if (event.key === 'ArrowLeft') showWork(activeIndex - 1);
  if (event.key === 'ArrowRight') showWork(activeIndex + 1);
});
render('all');

function openEditor(work) {
  editing = work;
  form.reset();
  editError.hidden = true;
  document.querySelector('#editor-title').textContent = work ? '编辑作品' : '上传作品';
  document.querySelector('#file-label').hidden = Boolean(work);
  fileInput.required = !work;
  nameInput.value = work?.name || '';
  dateInput.value = work?.date || '';
  editor.showModal();
  (work ? nameInput : fileInput).focus();
  if (work) nameInput.select();
}

uploadButton.onclick = () => openEditor();
renameButton.onclick = () => openEditor(visibleWorks[activeIndex]);
document.querySelector('#cancel-edit').onclick = () => editor.close();
fileInput.onchange = () => {
  if (!nameInput.value.trim() && fileInput.files[0]) {
    nameInput.value = fileInput.files[0].name.replace(/\.[^.]+$/, '').slice(0, 120);
  }
};

function storeWork(record) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('works', 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    transaction.objectStore('works').put(record);
  });
}

form.onsubmit = async event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const date = dateInput.value;
  const blob = fileInput.files[0];
  editError.hidden = true;
  if (!name || (!editing && !/^(image|video)\//.test(blob?.type || ''))) {
    editError.textContent = '请输入作品名称，并选择图片或视频文件。';
    editError.hidden = false;
    return;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  editor.oncancel = event => event.preventDefault();
  const cancel = document.querySelector('#cancel-edit');
  cancel.disabled = true;
  try {
    if (shared) {
      const id = editing?.key;
      const endpoint = id ? '/api/works/' + encodeURIComponent(id) : '/api/works';
      const response = await fetch(endpoint + '?designer=' + designer, {
        method: id ? 'PATCH' : 'POST',
        headers: {'X-Portfolio-Edit': '1', 'X-Work-Name': encodeURIComponent(name), 'X-Work-Date': date},
        body: id ? undefined : blob
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (editing) {
        updateEditedWork(result.name, result.date);
      } else {
        collection.unshift(result);
        monthSelect.value = 'all';
        filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === 'all')));
        render('all');
      }
      editor.close();
      return;
    }
    if (editing) {
      const key = editing.key || editing.file;
      const record = {key, name, date, blob: editing.blob, video: editing.video, added: editing.added, designer};
      await storeWork(record);
      updateEditedWork(name, date);
    } else {
      const key = 'upload-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      const record = {key, name, date, blob, video: blob.type.startsWith('video/'), added: Date.now(), designer};
      await storeWork(record);
      collection.unshift({...record, url: URL.createObjectURL(blob)});
      monthSelect.value = 'all';
      filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === 'all')));
      render('all');
    }
    editor.close();
  } catch (error) {
    editError.textContent = shared ? error.message || '保存失败，请稍后重试。' : '保存失败，请检查浏览器存储空间后重试。';
    editError.hidden = false;
  } finally {
    submit.disabled = false;
    cancel.disabled = false;
    editor.oncancel = null;
  }
};

function updateEditedWork(name, date) {
  editing.name = name;
  editing.date = date;
  render(activeFilter);
  activeIndex = visibleWorks.indexOf(editing);
  if (activeIndex === -1) {
    viewer.close();
    return;
  }
  document.querySelector('#position').textContent = (activeIndex + 1) + ' / ' + visibleWorks.length;
  document.querySelector('#work-title').textContent = name;
  const image = stage.querySelector('img');
  if (image) image.alt = name;
}

function enableEditing() {
  const request = indexedDB.open('hxrc-portfolio', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('works', {keyPath: 'key'});
  request.onerror = storageUnavailable;
  request.onsuccess = () => {
    database = request.result;
    const read = database.transaction('works').objectStore('works').getAll();
    read.onerror = storageUnavailable;
    read.onsuccess = () => {
      const records = read.result.filter(record => (record.designer || defaultDesigner) === designer);
      const overrides = new Map(records.map(record => [record.key, record]));
      const uploads = records.filter(record => record.blob).sort((a,b) => b.added - a.added);
      collection = [
        ...uploads.map(record => ({...record, url: URL.createObjectURL(record.blob)})),
        ...originalWorks.map(work => {
          const override = overrides.get(work.file);
          return override ? {...work, name: override.name, date: override.date} : work;
        })
      ];
      if (viewer.open) viewer.close();
      render(activeFilter);
      uploadButton.disabled = false;
      renameButton.disabled = false;
    };
  };
}

function storageUnavailable() {
  const notice = document.querySelector('#notice');
  notice.textContent = '当前浏览器无法使用本地存储，上传和编辑暂不可用。';
  notice.hidden = false;
}

if (shared) {
  document.querySelector('.local-note').textContent = '保存后，协作者刷新页面即可看到更新。';
  fetch('/api/works?designer=' + designer).then(async response => {
    if (!response.ok) throw new Error();
    const result = await response.json();
    collection = result.works;
    render(activeFilter);
    uploadButton.disabled = !result.canEdit;
    renameButton.disabled = !result.canEdit;
  }).catch(() => {
    const notice = document.querySelector('#notice');
    notice.textContent = '共享作品加载失败，请刷新重试。';
    notice.hidden = false;
  });
} else {
  try {
    if (designer === defaultDesigner) {
      Promise.all(works.map(async work => {
        try {
          const response = await fetch('media/' + work.file, {method: 'HEAD'});
          return response.ok ? work : null;
        } catch {
          return null;
        }
      })).then(available => {
        originalWorks.push(...available.filter(Boolean));
        collection = [...originalWorks];
        render(activeFilter);
        enableEditing();
      }).catch(storageUnavailable);
    } else {
      enableEditing();
    }
  } catch {
    storageUnavailable();
  }
}
