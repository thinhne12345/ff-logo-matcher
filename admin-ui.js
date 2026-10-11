/* The server authorizes every frame request. UI state is never authorization. */
let adminSession = false;
let adminPreviewGeneration = 0;
const adminPreviewUrls = new Set();
let adminPasswordConfigured = false;
let adminGithubConfigured = false;

function clearAdminPreviews() {
  adminPreviewGeneration++;
  for (const url of adminPreviewUrls) URL.revokeObjectURL(url);
  adminPreviewUrls.clear();
}
function resetAdminFrame() {
  adminSession = false;
  clearAdminPreviews();
  const option = document.querySelector('option[value="admin-01"]');
  if (option) option.remove();
  if ($('frameMode').value === 'admin-01' || !$('frameMode').value) $('frameMode').value = 'vietnam';
  $('adminLogout').hidden = true;
  $('adminLogin').hidden = !adminGithubConfigured;
  $('adminPasswordForm').hidden = false;
  $('adminPassword').disabled = !adminPasswordConfigured;
  $('adminPasswordSubmit').disabled = !adminPasswordConfigured;
  $('adminStatus').textContent = 'Mẫu 01 dành riêng cho admin.';
}
async function adminFrameImage() {
  const response = await fetch('/api/admin/frame-01.png', {credentials:'same-origin',cache:'no-store'});
  if (!response.ok) {
    if (response.status === 403) { resetAdminFrame(); render(); }
    const data = await response.json();
    throw new Error(data.error || 'Không tải được mẫu 01.');
  }
  return imageFromBlob(await response.blob());
}
function imageFromBlob(blob) {
  return new Promise((resolve,reject) => {
    const url = URL.createObjectURL(blob), image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh.')); };
    image.src = url;
  });
}
function fitLogoInsideCircle(width,height,radius) {
  const scale = 2 * radius / Math.hypot(width,height);
  return {width:width*scale,height:height*scale};
}
async function makeAdminPng(fileObj) {
  // Even a forged option or JS flag must pass the server's authenticated route.
  const frame = await adminFrameImage();
  const logo = await imageFromBlob(fileObj.file || await (await fetch(fileObj.url)).blob());
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1000;
  const ctx = canvas.getContext('2d',{alpha:true});
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.beginPath(); ctx.arc(500,500,373,0,Math.PI*2);
  ctx.fillStyle = '#000000'; ctx.fill();
  ctx.strokeStyle = '#6b7078'; ctx.lineWidth = 7; ctx.stroke();
  // Contain the COMPLETE original rectangle, including corners, inside the disk.
  // No recoloring, no crop, no AI redraw, no gold ring or flag over the logo.
  const size = fitLogoInsideCircle(logo.naturalWidth,logo.naturalHeight,363);
  ctx.drawImage(logo,(1000-size.width)/2,(1000-size.height)/2,size.width,size.height);
  ctx.drawImage(frame,0,0,1000,1000);
  return new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không tạo được PNG.')),'image/png'));
}
async function refreshAdminPreviews() {
  clearAdminPreviews();
  if (exportPreservesOriginal() || getFrameMode() !== 'admin-01') return;
  const generation = adminPreviewGeneration;
  // Sequential rendering bounds memory for large team lists.
  for (let i=0;i<teams.length;i++) {
    if (!teams[i].file) continue;
    try {
      const blob = await makeAdminPng(teams[i].file);
      if (generation !== adminPreviewGeneration) return;
      const target = $(`adminPreview${i}`);
      if (!target) continue;
      const url = URL.createObjectURL(blob); adminPreviewUrls.add(url); target.src = url;
    } catch (error) {
      if (generation !== adminPreviewGeneration) return;
      $('adminStatus').textContent = error.message; return;
    }
  }
}
async function initAdmin() {
  $('adminPasswordForm').onsubmit = async event => {
    event.preventDefault();
    const password = $('adminPassword').value;
    $('adminPasswordSubmit').disabled = true;
    $('adminStatus').textContent = 'Đang đăng nhập…';
    try {
      const response = await fetch('/api/admin/login', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
      const data = await response.json();
      if (!response.ok || data.admin !== true) throw new Error(data.error || 'Không thể đăng nhập admin.');
      await checkAdminSession();
    } catch (error) { $('adminStatus').textContent = error.message; }
    finally {
      $('adminPassword').value = '';
      $('adminPasswordSubmit').disabled = !adminPasswordConfigured;
    }
  };
  $('adminLogout').onclick = async () => {
    try {
      const response = await fetch('/api/admin/logout',{method:'POST',credentials:'same-origin'});
      if (!response.ok) throw new Error('Không đăng xuất được. Hãy thử lại.');
      resetAdminFrame(); render();
    } catch (error) { $('adminStatus').textContent = error.message; }
  };
  await checkAdminSession();
}
async function checkAdminSession() {
  try {
    const response = await fetch('/api/admin/session',{credentials:'same-origin',cache:'no-store'});
    if (!response.ok) throw new Error('Không kiểm tra được quyền admin.');
    const data = await response.json(); adminSession = data.admin === true;
    adminPasswordConfigured = data.passwordConfigured === true;
    adminGithubConfigured = data.githubConfigured === true;
    $('adminPassword').disabled = !adminPasswordConfigured;
    $('adminPasswordSubmit').disabled = !adminPasswordConfigured;
    if (adminSession) {
      const option = document.createElement('option'); option.value = 'admin-01';
      option.textContent = 'Mẫu 01 · Xanh bạc (Admin)';
      if (!document.querySelector('option[value="admin-01"]')) $('frameMode').append(option);
      $('adminLogin').hidden = true; $('adminLogout').hidden = false;
      $('adminPasswordForm').hidden = true;
      $('adminStatus').textContent = 'Đã đăng nhập admin · Mẫu 01 đã mở khóa.';
      $('frameMode').value = 'admin-01';
      $('preserveOriginal').checked = false;
      $('useBgLogo').checked = false;
      syncFrameModeAvailability(); syncBgLogoAvailability(); render();
    } else {
      $('adminPasswordForm').hidden = false;
      $('adminStatus').textContent = adminPasswordConfigured ? 'Nhập mật khẩu để mở mẫu 01 của admin.' : (adminGithubConfigured ? 'Đăng nhập GitHub để mở mẫu 01 của admin.' : 'Mẫu 01 đang chờ cấu hình đăng nhập admin.');
      $('adminLogin').hidden = !adminGithubConfigured;
    }
  } catch (error) { $('adminStatus').textContent = error.message; }
}
initAdmin();
