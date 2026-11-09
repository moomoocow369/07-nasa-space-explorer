// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');

// Find the button, the gallery, and the modal elements
const getImagesButton = document.getElementById('getImagesBtn');
const gallery = document.getElementById('gallery');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

// Your NASA API key. "DEMO_KEY" works for testing, but it has a low rate limit.
// Get your own free key at https://api.nasa.gov/ and paste it here.
const apiKey = 'DEMO_KEY';

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

  // Build the API URL using a template literal
  const url = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}&start_date=${startDate}&end_date=${endDate}&thumbs=true`;

  try {
    const response = await fetch(url);

    // If NASA sends back an error (like a bad date), stop here
    if (!response.ok) {
      throw new Error(`NASA API error: ${response.status}`);
    }

    const data = await response.json();

    // Show the newest photos first
    currentPhotos = data.reverse();
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
    mediaHTML = `<iframe src="${photo.url}" title="${photo.title}" allowfullscreen></iframe>`;
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
