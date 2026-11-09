// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');

// Find the button, the gallery, and the modal elements
const getImagesButton = document.getElementById('getImagesBtn');
const gallery = document.getElementById('gallery');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

// APOD now lives on science.nasa.gov. The old api.nasa.gov APOD API still reads
// the old site, so it returns the NASA logo for every day. Instead we read the
// APOD posts straight from the new site's public data feed (no API key needed).
const apodFeedUrl = 'https://science.nasa.gov/wp-json/wp/v2/image-article';

// Turn one APOD post from the feed into the photo object the gallery uses
function toPhoto(post) {
  // The post's content is a full HTML page section, so parse it to pull out parts
  const page = new DOMParser().parseFromString(post.content.rendered, 'text/html');

  // Title: use the page heading, or clean up "APOD: 2026 November 8 – Title"
  const heading = page.querySelector('h1');
  const fallbackTitle = new DOMParser()
    .parseFromString(post.title.rendered, 'text/html').body.textContent
    .replace(/^APOD:.*?[–-]\s*/, '');
  const title = heading ? heading.textContent.trim() : fallbackTitle;

  // Explanation: the description paragraph, without the "Explanation:" label
  // and the "Tomorrow's picture" teaser at the end
  const description = page.querySelector('.media-detail-hero__description');
  const explanation = description
    ? description.textContent
        .replace(/^\s*Explanation:\s*/, '')
        .split(/Tomorrow.s picture:/)[0]
        .trim()
    : 'No explanation available.';

  // Image: the post's main picture (strip the sizing options from the link)
  const imageBase = (post.featured_image_url || '').split('?')[0];

  // Video days have a <video> file or an embedded player (like YouTube)
  const videoFile = page.querySelector('video source, video[src]');
  const embed = page.querySelector('iframe[src]');
  const videoUrl = videoFile ? videoFile.getAttribute('src') : embed ? embed.getAttribute('src') : '';

  return {
    title,
    date: post.date.split('T')[0],
    explanation,
    media_type: videoUrl ? 'video' : 'image',
    url: videoUrl || `${imageBase}?w=800`, // smaller copy for the gallery
    hdurl: imageBase,                       // full size for the pop-up
    thumbnail_url: imageBase ? `${imageBase}?w=800` : '',
  };
}

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

// We save the photos from the last fetch so the modal can look them up
let currentPhotos = [];

// Fetch photos from NASA's APOD API for the selected date range
async function getSpaceImages() {
  const startDate = startInput.value;
  const endDate = endInput.value;

  // Show a loading message while we wait for the data
  gallery.innerHTML = `
    <div class="placeholder">
      <div class="placeholder-icon">🔄</div>
      <p>Loading space photos…</p>
    </div>
  `;

  // Build the feed URL. "after" skips posts at exactly midnight, so start one
  // second before the start date; end at the last second of the end date.
  const oneSecondBefore = new Date(new Date(`${startDate}T00:00:00Z`) - 1000).toISOString().slice(0, 19);
  const params = new URLSearchParams({
    search: 'apod',
    after: oneSecondBefore,
    before: `${endDate}T23:59:59`,
    per_page: 20,
    _fields: 'date,slug,title,content,featured_image_url',
  });
  const url = `${apodFeedUrl}?${params}`;

  try {
    const response = await fetch(url);

    // If NASA sends back an error, stop here
    if (!response.ok) {
      throw new Error(`NASA APOD error: ${response.status}`);
    }

    const posts = await response.json();

    // Keep only real APOD posts (their links start with "apod-"), newest first
    currentPhotos = posts
      .filter((post) => post.slug.startsWith('apod-'))
      .map(toPhoto)
      .sort((a, b) => b.date.localeCompare(a.date));
    displayGallery(currentPhotos);
  } catch (error) {
    console.error(error);
    gallery.innerHTML = `
      <div class="placeholder">
        <div class="placeholder-icon">⚠️</div>
        <p>Sorry, we couldn't load space photos. Please try again in a moment.</p>
      </div>
    `;
  }
}

// Build the gallery cards from the list of photos
function displayGallery(photos) {
  if (photos.length === 0) {
    gallery.innerHTML = `
      <div class="placeholder">
        <div class="placeholder-icon">🔭</div>
        <p>No photos found for those dates. Try a different range!</p>
      </div>
    `;
    return;
  }

  let galleryHTML = '';

  photos.forEach((photo, index) => {
    // Some APOD entries are videos instead of images
    let mediaHTML = '';
    if (photo.media_type === 'image') {
      mediaHTML = `<img src="${photo.url}" alt="${photo.title}" loading="lazy" />`;
    } else {
      // Use the video's thumbnail if NASA provides one
      const thumb = photo.thumbnail_url
        ? `<img src="${photo.thumbnail_url}" alt="${photo.title}" loading="lazy" />`
        : '';
      mediaHTML = `<div class="video-thumb">${thumb}<span class="video-badge">▶ Video</span></div>`;
    }

    galleryHTML += `
      <div class="gallery-item" data-index="${index}" tabindex="0" role="button" aria-label="Open ${photo.title}">
        ${mediaHTML}
        <h3 class="item-title">${photo.title}</h3>
        <p class="item-date">${formatDate(photo.date)}</p>
      </div>
    `;
  });

  gallery.innerHTML = galleryHTML;
}

// Turn "2024-05-01" into "May 1, 2024"
function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Open the modal and fill it with one photo's details
function openModal(photo) {
  let mediaHTML = '';
  if (photo.media_type === 'image') {
    // Use the high-resolution image (hdurl) when available
    const bigImage = photo.hdurl || photo.url;
    mediaHTML = `<img src="${bigImage}" alt="${photo.title}" />`;
  } else {
    // Video files (.mp4) play in a video player; other videos (like YouTube) embed
    mediaHTML = /\.(mp4|webm|mov)(\?|$)/i.test(photo.url)
      ? `<video src="${photo.url}" poster="${photo.thumbnail_url}" controls autoplay muted loop playsinline></video>`
      : `<iframe src="${photo.url}" title="${photo.title}" allowfullscreen></iframe>`;
  }

  modalBody.innerHTML = `
    ${mediaHTML}
    <h2>${photo.title}</h2>
    <p class="modal-date">${formatDate(photo.date)}</p>
    <p class="modal-explanation">${photo.explanation}</p>
  `;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden'; // stop the page behind from scrolling
  modalClose.focus();
}

// Close the modal
function closeModal() {
  modal.classList.remove('open');
  modalBody.innerHTML = ''; // clears the image and stops any video
  document.body.style.overflow = '';
}

// When the button is clicked, fetch new images
getImagesButton.addEventListener('click', getSpaceImages);

// When a gallery card is clicked, open the modal for that photo
gallery.addEventListener('click', (event) => {
  const item = event.target.closest('.gallery-item');
  if (item) {
    openModal(currentPhotos[item.dataset.index]);
  }
});

// Let keyboard users open a card with Enter
gallery.addEventListener('keydown', (event) => {
  const item = event.target.closest('.gallery-item');
  if (item && event.key === 'Enter') {
    openModal(currentPhotos[item.dataset.index]);
  }
});

// Close the modal with the X button, by clicking the dark background, or pressing Escape
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeModal();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal.classList.contains('open')) {
    closeModal();
  }
});
