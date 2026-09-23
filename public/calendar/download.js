const link = document.querySelector('#download');
const status = document.querySelector('#status');
if (link && status) {
  const source = link.href;
  let blobUrl = null;
  async function prepareDownload() {
    if (blobUrl) return;
    const response = await fetch(source);
    if (!response.ok) throw new Error('Calendar unavailable');
    const contents = await response.text();
    if (
      !contents.startsWith('BEGIN:VCALENDAR\r\n') ||
      !contents.includes('END:VCALENDAR')
    )
      throw new Error('Invalid calendar response');
    blobUrl = URL.createObjectURL(
      new Blob([contents], { type: 'text/calendar;charset=utf-8' }),
    );
    link.href = blobUrl;
  }
  link.addEventListener('click', async (event) => {
    if (blobUrl) return;
    event.preventDefault();
    try {
      await prepareDownload();
      link.click();
    } catch {
      status.textContent =
        'Unable to load the calendar. Please use the download link to retry.';
    }
  });
  prepareDownload()
    .then(() => {
      status.textContent =
        'Your calendar invite is ready. If the download does not start automatically, use the download link below.';
      link.click();
    })
    .catch(() => {
      status.textContent =
        'Unable to load the calendar. Please use the download link to retry.';
    });
}
