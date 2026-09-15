# EZ VAMPİR KÖYLÜ

KICK yayınları için çok oyunculu Vampir Köylü web oyunu. Tek sunucu, tek köy, tarayıcıdan oynanır.

## Rol kurulumu: slotlar

Rol dağılımı artık **slot** listesiyle belirlenir. Her slot bir oyuncuya karşılık gelir;
slot sayısı oyuncu sayısına eşit olmalıdır.

| Slot | Ne verir |
|---|---|
| Gardiyan | Her oyunda Gardiyan |
| Köy Araştırmacısı | Araştırmacı, Kâhin, Şerif, Takipçi, Casus |
| Köy Koruyucusu | Doktor, Koruma, Kapancı |
| Köy Savaşçısı | Veteran, Kanunsuz |
| Köy Destekçisi | Escort, Medyum, Yer Değiştiren, Rol Hırsızı, Başkan, Canlandırıcı |
| Rastgele Köylü | Yukarıdaki köy rollerinden herhangi biri |
| Edward / Vampir | Sabit |
| Rastgele Vampir | Vampir, Jigolo, Susturucu, Vampir Araştırmacı, Kamuflaj, Dolandırıcı |
| Seri Katil | Sabit |
| Rastgele Bağımsız | Joker, Survivor, İftiracı, Seri Katil |

Aynı rol bir oyunda iki kez çıkmaz (sabit slotlar hariç). "Otomatik dağıt" oyuncu
sayısına göre dengeli bir liste kurar. Lobideki **Slotlar** sekmesinden slot eklenip
çıkarılır; **Klasik** sekmesi eski "her role tek tek sayı ver" ekranıdır.

**Köylü rolü kaldırıldı.** Slot kurulumunda boş yer kalmaz, herkes bir role sahip olur.
Şans bonusu artık belirlenmiş slotlara (Gardiyan, Edward, Araştırmacı…) düşme
ihtimalini artırır; "Rastgele Köylü" slotları sona kalır.

## Roller

**Köy tarafı**

| Rol | Ne yapar |
|---|---|
| Köylü | Gece yeteneği yok |
| Doktor | Her gece birini saldırıdan korur |
| Bekçi | Bir kişiyi gözler, evine gelenleri görür |
| Kâhin | Bir kişinin gerçek rolünü öğrenir |
| Gardiyan | Gündüz seçer, gece hapseder. Hapisteki rolünü kullanamaz, kimse ona ulaşamaz, sadece Gardiyan ile yazışır ve onu "Gardiyan" olarak görür. 1 idam hakkı, doktoru deler |
| Escort | Bir kişiyi engeller. Gardiyanı engelleyemez |
| Başkan | Gündüz ilan ederse oyu 3 sayılır, tüm köye duyurulur |
| Canlandırıcı | Bir kere bir ölüyü diriltir. Dönen kişi gece yeteneğini kaybeder |
| Kanunsuz | 1 kurşun. Köy tarafında ama masum vurabilir |
| Casus | Vampir sohbetini okur ama isimler "Vampir 1", "Vampir 2" görünür. Vampirlerin kime gittiğini görür. Konuşamaz, gece yeteneği yok |

**Vampir tarafı**

| Rol | Ne yapar |
|---|---|
| Edward | Elebaşı. Hedefi o seçer |
| Vampir | Saldırıyı o yapar. Edward engellense de kil çıkar; vampirlerin hepsi engellenirse çıkmaz |
| Dolandırıcı | Bir oyuncunun vasiyetini değiştirir; ölünce sahte metin çıkar |

Edward ölürse yerine önce normal vampir, o da yoksa Dolandırıcı geçer ve emri o verir.
Casus köy tarafında olduğu için Edward olamaz.

**Tek başına**

| Rol | Ne yapar |
|---|---|
| Joker | Asılırsa kazanır |
| Seri Katil | Her gece bir kişi öldürür, son kalan olursa kazanır |
| Survivor | 2 yelek. Hayattaysa kim kazanırsa kazansın o da kazanır |

## Moderatör ve başlama

Odaya ilk giren moderatör olur. Ayarları o değiştirir, rol dağılımını o belirler,
istediği zaman moderatörlüğü başka bir oyuncuya devredebilir (oyuncu listesindeki ⇄ düğmesi).

Lobide herkes **Hazırım** der. Son kişi de hazır olunca 5 saniyelik geri sayım başlar ve
oyun kendiliğinden başlar. Biri vazgeçerse sayım durur. Moderatör isterse
"Herkesi beklemeden başlat" ile atlayabilir.

## Ana ekran

Köyde sabit **16 villa** var, halka şeklinde dizili. Ortada boş bir meydan ve
**idam tahtası** duruyor. Patikalar her villadan meydanın kenarına kadar gelir,
çemberin içine girmez — orası idam alanı.

**İdam.** Evet oyu çoğunluğu çıkarsa sanık ipe çekilir: birkaç saniye sallanır, bir toz
bulutu kalkar ve küçük bir hayalet süzülerek yukarı çıkar. Kanlı bir şey yok, çizgi film
tarzında. Darağacı paketin kendi paletiyle elle çizildi (pakette hazırı yoktu).

Gündüz herkes meydanın çevresinde toplanır. Gece olmadan 4 saniye önce patikadan
villasına yürür ve gece boyunca kapısının önünde durur. Oylamada suçlanan oyuncu
idam tahtasına çıkar ve savunmasını orada yapar.

### Takım renkleri

Sol paneldeki rol listesi takımlara ayrılmıştır: **Köy tarafı yeşil**,
**Vampir tarafı kırmızı**, **Tek başına sarı**. Seri Katil mavi, Joker sarı,
Survivor mor kendi tonlarını taşır.

Meydanda bir oyuncunun rolü sana görünüyorsa (kendi rolün, vampirsen takım
arkadaşların, ölmüş biri, oyun sonu) etiketi ve halkası o takımın rengine boyanır.
Rolü bilinmeyenler kendi forma renginde kalır — herkesin rengini herkese göstermek
oyunu ilk gün bitirirdi.

## Fısıldama

Gündüz köy sohbetinde `/w3 mesaj` yazarak 3 numaralı oyuncuya özel mesaj gönderilir.
Metni sadece iki taraf görür, mor renkte çıkar. Diğerleri sohbette sadece
"X, Y adlı oyuncuya fısıldıyor..." satırını görür. Ölüyken veya gece fısıldanamaz.

## Gündüz ve gece akışı

**Günde iki oylama turu var.** İlk turda kimse asılmazsa ikinci tur açılır. Biri
asılırsa gün orada biter. İlk gün tanışma günüdür, oylama yoktur.

**Sabah ölümler tek tek duyurulur.** Her ölünün satırı yazılır, bir saniye sonra
vasiyeti parşömende açılır, sonra sıradakine geçilir. Sabah özeti süresi ölü sayısına
göre uzar.

**Gece bağışıklığı.** Edward'a gece saldırısı işlemez. Saldıran kişiye "korunuyordu,
savunması çok güçlüydü" yazar — korunan biri ile bağışıklı biri aynı mesajı verir,
sebep sızmaz.

**Ölüm sebebi gizli.** Tuzağa basan, pusuya düşen ya da vampirin öldürdüğü kişi için
aynı havuzdan cümle seçilir; nasıl öldüğü anlaşılmaz.

## Vasiyet

Sol paneldeki **Vasiyet** sekmesinden yazılır, yazdıkça kaydedilir. İçeriği kimseye
görünmez, sohbete düşmez.

Ölünce ekranın ortasında bir **parşömen** açılır ve vasiyet herkese gösterilir:
gece ölenler sabah, asılanlar idamdan hemen sonra. Kapat düğmesiyle geçilir, dokuz
saniye sonra kendiliğinden kapanır; birden fazla vasiyet varsa sırayla açılır.
Telefonda da aynı şekilde ortada çıkar.

Açılmış vasiyetler ayrıca Vasiyet sekmesinde listelenir, sonradan bakılabilir.

Herkes hayattayken vasiyetini istediği zaman güncelleyebilir. Ölünce kilitlenir ve
ölüm duyurusunda herkese gösterilir. Dolandırıcı bir kişinin vasiyetini gece değiştirirse
o kişinin gerçek vasiyeti yerine sahte metin çıkar.

## Duruşma

İlk gün hariç her gün oylama var. En çok oy alan meydanın ortasına çıkar ve 20 saniye
savunma yapar — o sırada sadece o konuşabilir. Ardından köy evet/hayır oylar. Evet fazlaysa
asılır, değilse serbest kalır. Başkan ilan etmişse oyu 3 sayılır.

## Oyun akışı

```
Lobi → Roller dağıtılır → Gün 1 (tanışma, oylamasız)
     → Gece → Sabah özeti → Gün → Oylama → Sonuç → Gece → ...
```

**Gece:** Ölüm, gece bitmeden bir saniye önce haritada görünür — efekt orada oynar.
Ölenin rolü açıklanmaz (ayardan açılabilir).
Vampirler kendi aralarında konuşup kurban seçer (eşitlikte kura). Doktor korur,
Kâhin rol öğrenir, Bekçi ziyaretçileri görür. Bekçi dışarıdan izlediği için kendisi
ziyaretçi sayılmaz.

**Gündüz:** Herkes köy sohbetinde konuşur, sonra oylama açılır. En çok oyu alan asılır;
oylar eşitse kimse asılmaz. Ölüler kendi aralarında konuşmaya devam eder.

**Kazanma:** Tüm vampirler ölürse köy kazanır. Vampir sayısı diğerlerine eşitlenirse
vampirler kazanır. Joker asılırsa (ayar açıksa) oyun biter ve Joker tek başına kazanır.

## Sesli sohbet

Oyunun içinde, tarayıcıdan. Discord'a gerek yok. Telefondan girenler de katılabilir.

Üstteki **Sese katıl** düğmesine basınca mikrofon izni istenir. Yanındaki düğmeyle
kendini susturursun.

**Ses odaları faza göre ayrışır ve sunucu karar verir:**

| Faz | Kim kiminle konuşur |
|---|---|
| Lobi, gün, oylama | Yaşayan herkes |
| Gece | Sadece vampirler kendi aralarında |
| Ölüler | Sadece diğer ölülerle |

Bu bir susturma değil. Gece köylünün tarayıcısı vampirlerle **bağlantı bile kurmaz** —
ses paketi hiç gönderilmez. Biri istemciyi kurcalasa da duyamaz.

### Sınırlar ve TURN

Ses eşler arası (mesh WebRTC) taşınır, sunucudan geçmez. Bu bedava ve düşük gecikmeli,
ama herkes herkese ayrı ses gönderdiği için kişi sayısıyla yük hızla artar:

- 8 kişiye kadar rahat
- 10-12 kişi sınırda, zayıf yüklemesi olanlar zorlanır
- 16 kişide mobil bağlantılar takılabilir

Kalabalık oynayacaksan yönetilen bir ses sunucusuna (LiveKit, Daily gibi) geçmek gerekir.

Bazı mobil operatör ağlarının arkasındaki oyuncular için TURN sunucusu gerekebilir.
Ses kurulmuyorsa şu değişkenleri ekle:

- `TURN_URL` (örn. `turn:sunucu:3478`)
- `TURN_USERNAME`
- `TURN_PASSWORD`

Tanımlı değilse Google'ın bedava STUN sunucuları kullanılır, çoğu ev bağlantısında yeterlidir.

Mikrofon HTTPS ister. Render HTTPS verdiği için sorun olmaz; `localhost` da güvenli sayılır.

## Gizli görevler ve şans bonusu

Her oyunda **rastgele 3 kişiye** gizli görev verilir. Sadece o kişi kendi görevini görür;
kimin görev aldığı bile gizlidir. Görev havuzu `src/tasks.js` içinde, oradan düzenlersin.

Üç doğrulama tipi var:

- **Oyun takip eder** — hedefi astırmak, gün 3'e kadar yaşamak gibi. Sunucu kendisi sayar.
- **Oyun sahibi onaylar** — performans görevleri.
- **Köy oylar** — herkes "yaptı / yapmadı" der, çoğunluk karar verir.

Görevini beğenmeyen **bir kere değiştirebilir** (rol ekranı ve Gün 1 boyunca). Küfür
görevi gibi herkesin yapmak istemeyeceği şeyler için kaçış yolu.

### Ödül: rol şansı

Oyun bitince görev ekranı açılır, o üç kişinin görevi herkese gösterilir ve oylanır.
"Yaptı" oyu çoğunluğu alan oyuncunun **özel rol alma şansı %50 artar**.

Özel rol = köylü dışındaki her şey (vampir, doktor, bekçi, kâhin, joker).

Nasıl çalışıyor: her oyuncunun bir şans katsayısı var, başlangıçta 1. Görevi başaran
1.5'e çıkar, tekrar başarırsa 2.25'e. Roller dağıtılırken oyuncular bu katsayıya göre
ağırlıklı sıralanır, özel roller baştan dağıtılır. Katsayı ne kadar yüksekse özel rol
alma ihtimali o kadar artar.

Örnek: 8 oyuncu, 2 özel rol. Normal bir oyuncunun şansı %25. Katsayısı 3 olan oyuncunun
şansı %54'e çıkıyor (3000 oyunluk simülasyonla ölçüldü, `npm test` içinde).

**Bonus harcanır.** Oyuncu özel rol aldığı anda katsayısı 1'e döner. Böylece aynı kişi
sürekli özel rol almaz. Bunu ayarlardan kapatabilirsin, o zaman bonus birikmeye devam eder
(üst sınır 5 kat).

Şans katsayısı 1'den büyük olan oyuncuların yanında oyuncu listesinde yeşil bir rozet
görünür — kimin bonusu olduğu herkese açıktır.

Ayarlardan değiştirilebilenler: görev alan kişi sayısı (0-16), bonus yüzdesi (0-200),
bonusun harcanıp harcanmayacağı.

## Ayarlanabilenler

Sağ üstteki ⚙ düğmesinden, lobideyken oyun sahibi değiştirir:

- En az / en fazla oyuncu (4–16)
- Tartışma süresi: 40-120 saniye arası hazır seçenekler (varsayılan 60)
- İlk gün süresi ayrı: varsayılan 15 saniye (tanışma günü, oylama yok)
- Oylama, gece, rol gösterme ve özet süreleri
- Doktor kendini koruyabilir mi
- Doktor aynı kişiyi üst üste koruyabilir mi
- Joker asılınca oyun biter mi
- Ölenin rolü açıklanır mı (varsayılan: kapalı)
- İlk gün oylamasız tanışma olsun mu
- Herkes seçimini yapınca faz erken bitsin mi
- Gizli görevler açık mı, kaç kişiye verilir, bonus yüzdesi
- Sesli sohbet açık mı

## Bilgisayarda çalıştırma

Node.js 20+ gerekli.

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm start
```

Sonra `http://localhost:3000` aç. İlk giren oyun sahibi olur.

Test etmek için birkaç sekme aç, farklı isimlerle gir. En az oyuncu sayısını ayarlardan
4'e indirirsen tek başına da deneyebilirsin.

```bash
npm test        # oyun motorunun tam testi (soketsiz, hızlı)
```

## İnternete koyma

Repoda hazır deploy dosyaları var: `render.yaml`, `railway.json`, `Dockerfile`, `Procfile`.
Aşağıdaki iki yolun ikisi de ücretsiz katmanda çalışır.

### Yol 1 — Render (blueprint ile, en az uğraş)

1. Klasörü GitHub'a yeni bir repo olarak at (GitHub Desktop ya da `git init && git push`).
2. [render.com](https://render.com) → GitHub ile giriş yap.
3. **New → Blueprint** de, repoyu seç. `render.yaml` okunur, ayarlar kendiliğinden gelir.
4. Sadece `PUBLIC_URL` sor: Render'ın verdiği adresi yaz (`https://ez-vampir-koylu.onrender.com`).
   KICK alanlarını şimdilik boş bırakabilirsin.
5. Deploy bitince adres hazır. Sohbete linki at, oynayın.

Ücretsiz katmanda sunucu 15 dakika boş kalınca uykuya geçer, ilk açılış ~30 saniye sürer.
Yayın öncesi bir kere aç, uyanık kalsın.

### Yol 2 — Railway

1. Repoyu GitHub'a at.
2. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
3. Variables sekmesine `HOST_USERNAME=EMREZL` ve `PUBLIC_URL=<railway adresin>` ekle.
4. Settings → Networking → **Generate Domain**.

### Yol 3 — Docker

```bash
docker build -t ez-vampir-koylu .
docker run -p 3000:3000 -e HOST_USERNAME=EMREZL ez-vampir-koylu
```

### Ortam değişkenleri

| Değişken | Ne işe yarar |
|---|---|
| `PORT` | Hosting genelde kendi verir |
| `PUBLIC_URL` | `https://senin-domainin.com` |
| `HOST_USERNAME` | Üstteki tabelada yazan isim, örn. `EMREZL` |
| `ROOM_CODE` | İç kullanım, `KOY` bırakabilirsin |
| `KICK_CLIENT_ID` | KICK Developer uygulamandan |
| `KICK_CLIENT_SECRET` | KICK Developer uygulamandan |
| `KICK_REDIRECT_URI` | `https://senin-domainin.com/auth/kick/callback` |
| `KICK_PUBLIC_KEY` | Opsiyonel. Boşsa KICK API'sinden otomatik çekilir |

WebSocket kullanıldığı için hosting'in WebSocket desteklediğinden emin ol.

## KICK bağlantısı

**Giriş:** `/auth/kick` OAuth 2.1 + PKCE akışını başlatır. Kullanıcı KICK'te onay verince
`/auth/kick/callback` token'ı alır, KICK kullanıcı adını okur ve oyuna o isimle sokar.
Access token tarayıcıya hiç gönderilmez; sunucuda kalır, tarayıcıya sadece tek kullanımlık
bir bilet gider.

`.env` doldurulmamışsa KICK düğmesi görünmez, oyun demo isim girişiyle çalışır.

**Yayın sohbeti:** KICK uygulamanda `chat.message.sent` webhook aboneliği oluştur ve URL'yi

```
https://senin-domainin.com/webhooks/kick
```

olarak ayarla. Gelen mesajlar oyun içindeki "KICK" sohbet sekmesinde görünür. İzleyiciler
sadece okunur olarak akar, oyuna müdahale edemezler.

Webhook imzası **doğrulanıyor**: `Kick-Event-Signature` başlığı, KICK'in public key'iyle
`messageId.timestamp.gövde` üzerinden RSA-SHA256 olarak kontrol ediliyor. Ayrıca 5 dakikadan
eski istekler ve daha önce işlenmiş `Kick-Event-Message-Id` değerleri reddediliyor, böylece
kimse sahte sohbet mesajı enjekte edemiyor. İmzasız istek 401 döner.

## Güvenlik notları

- `KICK_CLIENT_SECRET` asla `public/` içine konmaz ve tarayıcıya gönderilmez.
- Roller sunucuda dağıtılır. İstemciye giden veride sadece o oyuncunun görmeye hakkı
  olan roller bulunur — köylü kimsenin rolünü göremez, vampir sadece diğer vampirleri görür.
- Vampir gece sohbeti ve ölü sohbeti sunucu tarafında filtrelenir, istemciye hiç gitmez.
- Linke girince eski adla otomatik giriş denenmez. Sadece **oyun sürerken** ve
  **kopalı bir dakikadan az** olmuşsa doğrudan geri bağlanır; aksi halde isim sorulur.
- İsimler o an odada bulunanlar arasında benzersiz olmalı; kalıcı olarak rezerve
  edilmez. Lobide biri çıkınca adı anında serbest kalır. Oyun sürerken kopan
  oyuncunun yeri korunur (geri dönebilsin diye); oyun bitince 20 saniye içinde düşer
  ve adı yeniden alınabilir. Aynı kural seçilen karakter için de geçerli.
  İsimler 2–16 karakter, sınırlı karakter setinde. Sohbette saniyede 2 mesaj sınırı var.
- Bağlantı koparsa oyuncu token'ıyla aynı koltuğa geri döner; sayfayı yenilemek oyunu bozmaz.

## Klasör yapısı

```
server.js              Express + Socket.IO, KICK OAuth ve webhook uçları
src/roles.js           Rol tanımları ve dağılım doğrulaması
src/tasks.js           Gizli görev havuzu
src/game.js            Oyun motoru: fazlar, gece çözümü, oylama, kazanma
src/kick.js            KICK OAuth 2.1 (PKCE) ve webhook imza doğrulaması
public/index.html      Arayüz iskeleti
public/css/style.css   Tema
public/js/client.js    İstemci mantığı ve panel çizimi
public/js/village.js   Karakter/köy görselleri (SVG)
public/js/voice.js     Sesli sohbet (mesh WebRTC)
test/simulate.js       Motor testleri
```
