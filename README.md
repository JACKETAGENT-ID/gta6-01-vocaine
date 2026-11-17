# Isla Verde — Open-World Crime

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/JACKETAGENT-ID/gta6-01-vocaine/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/JACKETAGENT-ID/gta6-01-vocaine/reward.svg)](https://make.fun/bounty/gta6-01)

**Isla Verde** adalah game open-world crime 2D top-down orisinal di sebuah pulau tropis:
pantai, pelabuhan, strip turis, jungle, dan desa nelayan — semuanya bisa dijelajahi
dengan berjalan kaki, naik mobil, atau naik perahu. Kau adalah kurir muda yang bekerja
untuk **Mara**, pengatur paket pulau ini. Antar paket, selundupkan muatan, rampok gudang
pelabuhan, kejar pengkhianat di laut lepas, dan selamat dari badai terakhir.

## Yang ada di dalam game

- **Pulau terbuka 3200×3200** — Kota Verde, Strip Marisol, Pelabuhan Coral, Desa Nelayan, Jungle Verde, dan Mercusuar Tanjung Utara, dikelilingi laut yang bisa dilayari
- **6 kendaraan** — sedan, pickup, motor, van, speedboat, perahu nelayan; semuanya bisa dicuri
- **Lalu lintas & pejalan kaki** yang bergerak di jalan dan trotoar
- **Sistem buronan 0–5 bintang** — polisi mengejar di darat, Coast Guard mengejar di laut, roadblock & checkpoint pelabuhan di bintang 3+
- **6 misi bercerita** dengan dialog, penanda tujuan, dan hadiah uang
- **Combat** — pistol (beli peluru di Toko Senjata Roko) dan pukulan
- **20 peti harta karun tersembunyi** di pantai, jungle, dan desa
- **HUD lengkap + minimap**, peta besar (M), layar start / jeda, dan save di localStorage
- **Suara prosedural WebAudio** — ombak, mesin, sirene, hujan badai, dan radio 3 stasiun
- **Siklus siang/malam** dan **badai tropis** dengan hujan + petir

## Cara main

Buka `game/index.html` di desktop Chrome (atau jalankan server statis apa pun di folder `game/`).
Tidak butuh internet — semua file lokal.

| Kontrol | Aksi |
|---|---|
| WASD / panah | Gerak & mengemudi |
| Shift | Lari |
| E | Masuk/curi kendaraan, bicara, ambil peti, beli |
| Spasi | Pukul |
| Klik mouse | Tembak pistol |
| R | Ganti stasiun radio |
| H | Klakson |
| M | Peta besar |
| Esc | Jeda & simpan |

Kejahatan menaikkan bintang buronan. Bersembunyilah sampai bintang turun, atau kabur
lewat laut saat polisi menutup jalan.

## Teknologi

Vanilla JavaScript + Canvas 2D, tanpa library dan tanpa aset unduhan. Semua gambar
digambar lewat kode, semua suara disintesis dengan WebAudio.

Entri untuk kompetisi [Make GTA 6 di make.fun](https://make.fun/bounty/gta6-01).
Game orisinal — bukan bagian dari seri game komersial mana pun.

Lisensi: MIT.
