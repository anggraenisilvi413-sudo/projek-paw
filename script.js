/* =========================================================
   script.js - Interaktivitas Portofolio & Pengumpulan Tugas
   Fitur:
   1. Hitung jumlah tugas per status
   2. Filter tugas berdasarkan status
   3. Info sisa hari menuju tenggat
   4. Modal detail tugas
   5. Highlight menu navigasi sesuai section yang sedang dilihat
   ========================================================= */
(function () {
  'use strict';

  var daftar = document.getElementById('daftar-tugas');
  var items = Array.prototype.slice.call(daftar.querySelectorAll('.tugas-item'));
  var tombolFilter = document.querySelectorAll('.filter-btn');
  var infoFilter = document.getElementById('info-filter');
  var pesanKosong = document.getElementById('kosong');

  /* ---------- 1. Ringkasan jumlah per status ---------- */
  function hitungStatus(status) {
    return items.filter(function (item) {
      return item.getAttribute('data-status') === status;
    }).length;
  }

  function isiRingkasan() {
    document.getElementById('jml-total').textContent = items.length;
    document.getElementById('jml-selesai').textContent = hitungStatus('selesai');
    document.getElementById('jml-proses').textContent = hitungStatus('proses');
    document.getElementById('jml-belum').textContent = hitungStatus('belum');
  }

  /* ---------- 2. Filter berdasarkan status ---------- */
  function terapkanFilter(status) {
    var tampil = 0;

    items.forEach(function (item) {
      var cocok = status === 'semua' || item.getAttribute('data-status') === status;
      item.hidden = !cocok;
      if (cocok) {
        tampil++;
      }
    });

    tombolFilter.forEach(function (tombol) {
      var aktif = tombol.getAttribute('data-filter') === status;
      tombol.setAttribute('aria-pressed', aktif ? 'true' : 'false');
    });

    infoFilter.textContent = 'Menampilkan ' + tampil + ' dari ' + items.length + ' tugas.';
    pesanKosong.hidden = tampil !== 0;
  }

  tombolFilter.forEach(function (tombol) {
    tombol.addEventListener('click', function () {
      terapkanFilter(tombol.getAttribute('data-filter'));
    });
  });

  /* ---------- 3. Sisa hari menuju tenggat ---------- */
  function hariSampai(tanggalISO) {
    var bagian = tanggalISO.split('-');
    var tenggat = new Date(Number(bagian[0]), Number(bagian[1]) - 1, Number(bagian[2]));
    var sekarang = new Date();
    var hariIni = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
    return Math.round((tenggat - hariIni) / 86400000);
  }

  function teksSisa(selisih) {
    if (selisih > 1) {
      return '(sisa ' + selisih + ' hari)';
    }
    if (selisih === 1) {
      return '(besok)';
    }
    if (selisih === 0) {
      return '(hari ini)';
    }
    return '(terlambat ' + Math.abs(selisih) + ' hari)';
  }

  function isiSisaHari() {
    items.forEach(function (item) {
      // Tugas yang sudah dikerjakan tidak perlu info sisa hari
      if (item.getAttribute('data-status') === 'selesai') {
        return;
      }
      var waktu = item.querySelector('time');
      var sisa = item.querySelector('.sisa');
      if (waktu && sisa) {
        sisa.textContent = teksSisa(hariSampai(waktu.getAttribute('datetime')));
      }
    });
  }

  /* ---------- 4. Modal detail tugas ---------- */
  var modal = document.getElementById('modal-tugas');
  var tombolTutup = document.getElementById('modal-tutup');
  var tombolPemicu = null; // untuk mengembalikan fokus setelah modal ditutup

  function bukaModal(item, pemicu) {
    var kartu = item.querySelector('.tugas-card');

    document.getElementById('modal-judul').textContent = kartu.querySelector('h3').textContent;
    document.getElementById('modal-matkul').textContent = kartu.querySelector('.matkul').textContent;
    document.getElementById('modal-deskripsi').textContent = kartu.querySelector('.deskripsi').textContent.trim();

    // Salin badge status
    var wadahStatus = document.getElementById('modal-status');
    wadahStatus.innerHTML = '';
    wadahStatus.appendChild(kartu.querySelector('.badge').cloneNode(true));

    // Salin teks tenggat (tanpa info sisa hari agar ringkas)
    var waktu = kartu.querySelector('time');
    document.getElementById('modal-deadline').textContent = 'Tenggat: ' + waktu.textContent;

    // Salin tombol aksi (kecuali tombol Detail)
    var wadahAksi = document.getElementById('modal-aksi');
    wadahAksi.innerHTML = '';
    kartu.querySelectorAll('.aksi a, .aksi .btn-disabled').forEach(function (el) {
      wadahAksi.appendChild(el.cloneNode(true));
    });

    tombolPemicu = pemicu;

    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  function tutupModal() {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
    if (tombolPemicu) {
      tombolPemicu.focus();
    }
  }

  items.forEach(function (item) {
    var tombolDetail = item.querySelector('[data-detail]');
    if (tombolDetail) {
      tombolDetail.addEventListener('click', function () {
        bukaModal(item, tombolDetail);
      });
    }
  });

  tombolTutup.addEventListener('click', tutupModal);

  // Link menuju bagian halaman yang sama (href diawali #) menutup modal dulu
  document.getElementById('modal-aksi').addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (link && link.getAttribute('href').charAt(0) === '#') {
      tutupModal();
    }
  });

  // Klik di area gelap (di luar kotak modal) menutup modal
  modal.addEventListener('click', function (e) {
    if (e.target === modal) {
      tutupModal();
    }
  });

  /* ---------- 5. Highlight menu navigasi ---------- */
  function aktifkanMenu() {
    var linkMenu = document.querySelectorAll('.nav-list a');
    var sections = document.querySelectorAll('main section[id]');

    if (!('IntersectionObserver' in window)) {
      return;
    }

    var pengamat = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          linkMenu.forEach(function (link) {
            var cocok = link.getAttribute('href') === '#' + entry.target.id;
            link.classList.toggle('aktif', cocok);
            if (cocok) {
              link.setAttribute('aria-current', 'true');
            } else {
              link.removeAttribute('aria-current');
            }
          });
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });

    sections.forEach(function (section) {
      pengamat.observe(section);
    });
  }

  /* ---------- Jalankan saat halaman siap ---------- */
  isiRingkasan();
  isiSisaHari();
  terapkanFilter('semua');
  aktifkanMenu();
})();
