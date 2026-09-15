# PC'de kurulum

Zip'i indir, sağ tık → **Tümünü ayıkla**. Çıkan klasörün içindeki dosyalarla çalışacaksın.

## 1. Bilgisayarda oynamak

`baslat.bat` dosyasına çift tıkla. (Mac'te `baslat.command`.)

İlk çalıştırmada Node.js yoksa indirme sayfasını açar — LTS sürümünü kur, sonra tekrar çift tıkla.
Paketleri kendisi kurar, tarayıcıyı kendisi açar.

Windows "bilinmeyen yayıncı" uyarısı verirse **Ek bilgi** → **Yine de çalıştır**.

Test için birkaç sekme aç, farklı isimlerle gir. Ayarlardan en az oyuncuyu 4'e indirirsen
tek başına da deneyebilirsin.

Kapatmak için siyah pencereyi kapat.

## 2. GitHub'a yükleme

`github-yukle.bat` dosyasına çift tıkla. Repo adresini soracak, şunu yapıştır:

```
https://github.com/emreozogul50/Emrezlatan-game-.git
```

Git kurulu değilse indirme sayfasını açar, kurup tekrar çalıştır. İlk seferde GitHub
kullanıcı adı ve şifre soracak — bir tarayıcı penceresi açılır, oradan onayla.

Bu script repodaki her şeyi klasördeki haliyle değiştirir. Telefondan attığın dosyalar
silinir, doğru klasör yapısı kurulur. İstediğin bu.

## 3. Render'a kurma

1. [render.com](https://render.com) → GitHub ile giriş.
2. **New +** → **Blueprint** → repoyu seç. (Blueprint yoksa **Web Service** seç ve
   aşağıdaki tabloyu elle doldur.)
3. Deploy 3-5 dakika sürer. Bitince adresi al.
4. Render panelinde **Environment** → `PUBLIC_URL` değişkenine o adresi yaz → kaydet.

Elle Web Service kuruyorsan:

| Alan | Değer |
|---|---|
| Name | `vampirkoylu` |
| Region | Frankfurt |
| Branch | `main` |
| Language | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |

Environment Variables: `HOST_USERNAME` = `EMREZL`

## Sık takılan yerler

**Sayfa boş açılıyor:** `index.html` reponun kökünde kalmış olabilir. `public/index.html`
olmalı. `github-yukle.bat` kullandıysan bu sorun olmaz.

**Render'da ilk açılış çok yavaş:** Ücretsiz katman 15 dakika boşta kalınca uyur, ilk istek
~30 saniye sürer. Yayından önce bir kere aç.

**Oyuncular birbirini görmüyor:** Hosting'in WebSocket desteklediğinden emin ol. Render
destekliyor.
