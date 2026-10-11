/* =========================================================
   script.js - Hub Tugas online (Supabase)
   - Semua pengunjung bisa MELIHAT tugas dan file.
   - Hanya pemilik (login) yang bisa tambah / edit / hapus.
   ========================================================= */
(function () {
  'use strict';

  // ====== ISI DUA BARIS INI (Supabase > Project Settings > API) ======
  var SUPABASE_URL = 'https://jjxahmueunzlczoqcdlw.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_vvJumH2X4I9a0h6OkLoY5Q_y-DAT-4Q';
  // ===================================================================

  var BUCKET = 'berkas-tugas';
  var MAKS_FILE = 10 * 1024 * 1024; // 10 MB
  var STATUS = { selesai: 'Sudah Dikerjakan', proses: 'Sedang Diproses', belum: 'Belum Dikerjakan' };
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
               'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  var sb, admin = false, data = [], filterAktif = 'semua', tugasEdit = null, fokusBalik = null;

  function $(id) { return document.getElementById(id); }

  function buatEl(tag, kelas, teks) {
    var el = document.createElement(tag);
    if (kelas) { el.className = kelas; }
    if (teks) { el.textContent = teks; }
    return el;
  }

  /* ---------- Helper tanggal & link ---------- */
  function tanggalIndo(iso) {
    var p = iso.split('-');
    return Number(p[2]) + ' ' + BULAN[Number(p[1]) - 1] + ' ' + p[0];
  }

  function hariSampai(iso) {
    var p = iso.split('-');
    var tenggat = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    var n = new Date();
    return Math.round((tenggat - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
  }

  function teksSisa(s) {
    if (s > 1) { return '(sisa ' + s + ' hari)'; }
    if (s === 1) { return '(besok)'; }
    if (s === 0) { return '(hari ini)'; }
    return '(terlambat ' + Math.abs(s) + ' hari)';
  }

  function amanUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }

  /* ---------- Dialog ---------- */
  function buka(d, pemicu) {
    fokusBalik = pemicu || null;
    if (typeof d.showModal === 'function') { d.showModal(); } else { d.setAttribute('open', ''); }
  }

  function tutup(d) {
    if (typeof d.close === 'function') { d.close(); } else { d.removeAttribute('open'); }
    if (fokusBalik && document.body.contains(fokusBalik)) { fokusBalik.focus(); }
  }

  function klikLuarTutup(d) {
    d.addEventListener('click', function (e) { if (e.target === d) { tutup(d); } });
  }

  /* ---------- Tampilan kartu ---------- */
  function buatBadge(status) { return buatEl('span', 'badge badge-' + status, STATUS[status]); }

  function buatLink(teks, url, kelas) {
    var a = buatEl('a', kelas, teks);
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  function buatAksi(t, dalamModal) {
    var wadah = buatEl('div', 'aksi');
    var adaTombol = false;

    if (!dalamModal) {
      var detail = buatEl('button', 'btn btn-ghost', 'Detail');
      detail.type = 'button';
      detail.addEventListener('click', function () { bukaDetail(t, detail); });
      wadah.appendChild(detail);
    }
    if (amanUrl(t.file_url)) {
      var bisa = /^(application\/pdf|image\/|text\/)/.test(t.file_type || '');
      var href = bisa ? t.file_url : t.file_url + '?download=' + encodeURIComponent(t.file_nama);
      wadah.appendChild(buatLink(bisa ? 'Lihat File' : 'Unduh File', href, 'btn'));
      adaTombol = true;
    }
    if (amanUrl(t.link)) {
      wadah.appendChild(buatLink('Lihat Tugas', t.link, 'btn'));
      adaTombol = true;
    }
    if (!adaTombol) {
      var mati = buatEl('span', 'btn btn-disabled', 'File / link belum ditambahkan');
      mati.setAttribute('aria-disabled', 'true');
      wadah.appendChild(mati);
    }
    if (amanUrl(t.repo)) {
      wadah.appendChild(buatLink('Link Repository', t.repo, 'btn btn-outline'));
    }
    return wadah;
  }

  function buatKartu(t) {
    var li = buatEl('li', 'tugas-item');
    li.setAttribute('data-status', t.status);
    var kartu = buatEl('article', 'tugas-card');

    kartu.appendChild(buatEl('h3', '', t.nama));
    kartu.appendChild(buatEl('p', 'matkul', t.matkul));

    var dl = buatEl('p', 'deadline', 'Tenggat: ' + tanggalIndo(t.tenggat) + ' ');
    if (t.status !== 'selesai') {
      dl.appendChild(buatEl('span', 'sisa', teksSisa(hariSampai(t.tenggat))));
    }
    kartu.appendChild(dl);

    var pb = document.createElement('p');
    pb.appendChild(buatBadge(t.status));
    kartu.appendChild(pb);

    kartu.appendChild(buatAksi(t, false));
    li.appendChild(kartu);
    return li;
  }

  /* ---------- Render daftar, ringkasan, filter ---------- */
  function hitung(status) {
    return data.filter(function (t) { return t.status === status; }).length;
  }

  function render() {
    var daftar = $('daftar-tugas');
    daftar.innerHTML = '';
    var tampil = data.filter(function (t) { return filterAktif === 'semua' || t.status === filterAktif; });
    tampil.forEach(function (t) { daftar.appendChild(buatKartu(t)); });

    $('jml-total').textContent = data.length;
    $('jml-selesai').textContent = hitung('selesai');
    $('jml-proses').textContent = hitung('proses');
    $('jml-belum').textContent = hitung('belum');

    document.querySelectorAll('.filter-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-filter') === filterAktif ? 'true' : 'false');
    });

    var kosong = $('kosong');
    if (data.length === 0) {
      kosong.textContent = admin ? 'Belum ada tugas. Klik "Tambah Tugas" untuk mulai.' : 'Belum ada tugas yang ditambahkan.';
    } else {
      kosong.textContent = 'Tidak ada tugas dengan status ini.';
    }
    kosong.hidden = tampil.length !== 0;
    $('info-filter').textContent = data.length ? 'Menampilkan ' + tampil.length + ' dari ' + data.length + ' tugas.' : '';
  }

  document.querySelectorAll('.filter-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      filterAktif = b.getAttribute('data-filter');
      render();
    });
  });

  /* ---------- Data dari Supabase ---------- */
  function muat() {
    return sb.from('tugas').select('*').order('tenggat', { ascending: true }).then(function (r) {
      if (r.error) { throw r.error; }
      data = r.data || [];
      render();
    });
  }

  function unggah(berkas) {
    var ext = (berkas.name.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    var path = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    var bucket = sb.storage.from(BUCKET);
    return bucket.upload(path, berkas, { contentType: berkas.type || 'application/octet-stream' }).then(function (r) {
      if (r.error) { throw r.error; }
      return { path: path, url: bucket.getPublicUrl(path).data.publicUrl };
    });
  }

  function hapusFile(path) {
    return path ? sb.storage.from(BUCKET).remove([path]) : Promise.resolve();
  }

  /* ---------- Modal detail ---------- */
  var modalDetail = $('modal-tugas');

  function bukaDetail(t, pemicu) {
    $('modal-judul').textContent = t.nama;
    $('modal-matkul').textContent = t.matkul;
    $('modal-status').innerHTML = '';
    $('modal-status').appendChild(buatBadge(t.status));
    $('modal-deadline').textContent = 'Tenggat: ' + tanggalIndo(t.tenggat);
    $('modal-deskripsi').textContent = t.deskripsi || 'Tidak ada deskripsi.';

    var aksi = buatAksi(t, true);
    aksi.id = 'modal-aksi';
    if (t.file_nama) { aksi.appendChild(buatEl('span', 'bantuan', 'File: ' + t.file_nama)); }

    if (admin) {
      var edit = buatEl('button', 'btn btn-outline', 'Edit');
      edit.type = 'button';
      edit.addEventListener('click', function () { tutup(modalDetail); bukaForm(t, pemicu); });
      var hapus = buatEl('button', 'btn btn-bahaya', 'Hapus');
      hapus.type = 'button';
      hapus.addEventListener('click', function () {
        if (!window.confirm('Hapus tugas "' + t.nama + '"?')) { return; }
        sb.from('tugas').delete().eq('id', t.id).then(function (r) {
          if (r.error) { throw r.error; }
          hapusFile(t.file_path);
          tutup(modalDetail);
          return muat();
        }).catch(function () { window.alert('Gagal menghapus tugas.'); });
      });
      aksi.appendChild(edit);
      aksi.appendChild(hapus);
    }

    var lama = $('modal-aksi');
    lama.parentNode.replaceChild(aksi, lama);
    buka(modalDetail, pemicu);
  }

  $('modal-tutup').addEventListener('click', function () { tutup(modalDetail); });
  klikLuarTutup(modalDetail);

  /* ---------- Modal form tambah / edit (hanya pemilik) ---------- */
  var modalForm = $('modal-form');

  function bukaForm(t, pemicu) {
    tugasEdit = t;
    $('form-judul').textContent = t ? 'Edit Tugas' : 'Tambah Tugas';
    $('f-nama').value = t ? t.nama : '';
    $('f-matkul').value = t ? t.matkul : '';
    $('f-tenggat').value = t ? t.tenggat : '';
    $('f-status').value = t ? t.status : 'belum';
    $('f-deskripsi').value = t ? t.deskripsi : '';
    $('f-link').value = t ? t.link : '';
    $('f-repo').value = t ? t.repo : '';
    $('f-file').value = '';
    $('f-file-info').textContent = t && t.file_nama ? 'File saat ini: ' + t.file_nama + '. Pilih file baru untuk menggantinya.' : '';
    $('f-error').textContent = '';
    buka(modalForm, pemicu);
  }

  $('btn-tambah').addEventListener('click', function () { bukaForm(null, $('btn-tambah')); });
  $('form-tutup').addEventListener('click', function () { tutup(modalForm); });
  $('form-batal').addEventListener('click', function () { tutup(modalForm); });
  klikLuarTutup(modalForm);

  $('form-tugas').addEventListener('submit', function (e) {
    e.preventDefault();
    var galat = $('f-error');
    var tombol = e.target.querySelector('button[type="submit"]');
    var berkas = $('f-file').files[0];
    var link = $('f-link').value.trim();
    var repo = $('f-repo').value.trim();

    if (berkas && berkas.size > MAKS_FILE) { galat.textContent = 'Ukuran file maksimal 10 MB.'; return; }
    if ((link && !amanUrl(link)) || (repo && !amanUrl(repo))) {
      galat.textContent = 'Link harus diawali http:// atau https://';
      return;
    }

    tombol.disabled = true;
    galat.textContent = 'Menyimpan...';

    (berkas ? unggah(berkas) : Promise.resolve(null)).then(function (f) {
      var baris = {
        nama: $('f-nama').value.trim(),
        matkul: $('f-matkul').value.trim(),
        tenggat: $('f-tenggat').value,
        status: $('f-status').value,
        deskripsi: $('f-deskripsi').value.trim(),
        link: link,
        repo: repo
      };
      if (f) {
        baris.file_url = f.url;
        baris.file_path = f.path;
        baris.file_nama = berkas.name;
        baris.file_type = berkas.type;
      }
      var q = tugasEdit ? sb.from('tugas').update(baris).eq('id', tugasEdit.id) : sb.from('tugas').insert(baris);
      return q.then(function (r) {
        if (r.error) { throw r.error; }
        if (f && tugasEdit) { hapusFile(tugasEdit.file_path); }
      });
    }).then(function () {
      tutup(modalForm);
      return muat();
    }).catch(function () {
      galat.textContent = 'Gagal menyimpan. Pastikan kamu masih login dan koneksi internet aktif.';
    }).then(function () {
      tombol.disabled = false;
    });
  });

  /* ---------- Login pemilik ---------- */
  var dialogLogin = buatEl('dialog', 'modal');
  dialogLogin.setAttribute('aria-labelledby', 'login-judul');
  dialogLogin.innerHTML =
    '<form class="modal-isi" id="form-login">' +
    '<button type="button" class="modal-tutup" data-batal aria-label="Tutup">&times;</button>' +
    '<h2 id="login-judul">Masuk Pemilik</h2>' +
    '<p class="bantuan">Hanya pemilik web yang perlu masuk untuk mengelola tugas.</p>' +
    '<div class="field"><label for="l-email">Email</label><input type="email" id="l-email" required autocomplete="username"></div>' +
    '<div class="field"><label for="l-pass">Kata sandi</label><input type="password" id="l-pass" required autocomplete="current-password"></div>' +
    '<p class="galat" id="l-error" role="alert"></p>' +
    '<div class="aksi"><button type="submit" class="btn">Masuk</button>' +
    '<button type="button" class="btn btn-outline" data-batal>Batal</button></div></form>';
  document.body.appendChild(dialogLogin);
  klikLuarTutup(dialogLogin);
  dialogLogin.querySelectorAll('[data-batal]').forEach(function (b) {
    b.addEventListener('click', function () { tutup(dialogLogin); });
  });

  dialogLogin.querySelector('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var galat = $('l-error');
    galat.textContent = 'Memeriksa...';
    sb.auth.signInWithPassword({ email: $('l-email').value.trim(), password: $('l-pass').value }).then(function (r) {
      if (r.error) {
        galat.textContent = 'Email atau kata sandi salah.';
      } else {
        $('l-pass').value = '';
        galat.textContent = '';
        tutup(dialogLogin);
      }
    });
  });

  var btnAuth = buatEl('button', 'btn btn-ghost', 'Masuk pemilik');
  btnAuth.type = 'button';
  btnAuth.style.display = 'none';
  document.querySelector('.site-footer .container').appendChild(btnAuth);
  btnAuth.addEventListener('click', function () {
    if (admin) { sb.auth.signOut(); } else { buka(dialogLogin, btnAuth); }
  });

  function aturAdmin() {
    $('btn-tambah').style.display = admin ? '' : 'none';
    btnAuth.textContent = admin ? 'Keluar (pemilik)' : 'Masuk pemilik';
    document.querySelector('.intro').textContent = admin
      ? 'Kamu masuk sebagai pemilik. Klik Tambah Tugas untuk mencatat tugas beserta file-nya.'
      : 'Daftar tugas kuliah beserta tenggat, status pengerjaan, dan file yang sudah dikumpulkan.';
    render();
  }

  /* ---------- Highlight menu navigasi ---------- */
  if ('IntersectionObserver' in window) {
    var linkMenu = document.querySelectorAll('.nav-list a');
    var pengamat = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        linkMenu.forEach(function (link) {
          var cocok = link.getAttribute('href') === '#' + entry.target.id;
          link.classList.toggle('aktif', cocok);
          if (cocok) { link.setAttribute('aria-current', 'true'); } else { link.removeAttribute('aria-current'); }
        });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    document.querySelectorAll('main section[id]').forEach(function (s) { pengamat.observe(s); });
  }

  /* ---------- Mulai ---------- */
  function muatLib() {
    return new Promise(function (ok, gagal) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.js';
      s.onload = ok;
      s.onerror = gagal;
      document.head.appendChild(s);
    });
  }

  $('btn-tambah').style.display = 'none';

  if (SUPABASE_URL.indexOf('XXXX') !== -1) {
    render();
    $('info-filter').textContent = 'Konfigurasi Supabase belum diisi di script.js.';
    return;
  }

  $('info-filter').textContent = 'Memuat tugas...';
  muatLib().then(function () {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    btnAuth.style.display = '';
    sb.auth.onAuthStateChange(function (_event, sesi) {
      admin = !!sesi;
      aturAdmin();
    });
    return muat();
  }).catch(function () {
    render();
    $('info-filter').textContent = 'Gagal memuat tugas. Periksa koneksi internet atau konfigurasi Supabase.';
  });
})();
