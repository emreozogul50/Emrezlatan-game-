# Köy sahnesi (Phaser 3)

Sahne artık **oyunun içinde**. Normal adresi aç, köy karşında.

`/sahne.html` ayrı bir demo olarak duruyor (16 sahte oyuncuyla, sunucusuz).

## Eski görünüme dönmek

⚙ → **Görünüm** → "Yeni köy sahnesi" anahtarını kapat. Anında eski basit sahneye döner,
tercih tarayıcında saklanır. Sadece senin ekranını etkiler, diğer oyuncuları değiştirmez.

## Ne var

- **Motor:** Phaser 3.90, `public/vendor/phaser.min.js`. npm bağımlılığı değil, dosya
  repoda — Render'da ek kurulum gerektirmez.
- **Dünya:** 2000x1125 (16:9), kamera yakın — evler kadrajı doldurur ve kenarlardan taşar.
- **Meydan:** ortada büyük dairesel taş döşeme, merkezinde dekoratif kuyu,
  çevresinde 10 fener. Oyuncuların toplanacağı alan boş bırakıldı.
- **Evler:** 16 farklı ev tasarımı, toplam ~40 bina. Hepsi normal köy evi —
  han, market, demirci veya herhangi bir tabela yok.
- **Dekor:** ağaçlar (animasyonlu), çalılar (animasyonlu), çitler, fenerler,
  variller, sandıklar, taşlar, çiçekler, ot tutamları, odun yığınları.
- **Ön plan:** kadrajın altında büyük ağaçlar ve çit hattı — derinlik için.
- **Işık:** ışık kaynağı yok. Fener, meydan parıltısı ve pointlight'ların hepsi
  kaldırıldı. Sadece hafif gece tonu ve kenar karartması var.
- **Meydan:** boş. Darağacı ve kuyu kaldırıldı.
- **Karakterler:** 16 ayrı görünüm, hepsi idle animasyonlu. Her oyuncu **kendi yolunun
  meydanla birleştiği noktada** bekler — kimin hangi eve ait olduğu bakınca anlaşılır.
- **İsimler:** canvas üstünde ayrı HTML katmanı, kamerayla senkron. Yükseklik
  karakterin boyundan hesaplanır, üstünü kapatmaz; üst üste binmesin diye şaşırtmalı. Karakterlerin üstünde rozet/logo yok.
- **Oyun sahibi paneli:** üstte ayrı UI, çizilmiş taç görseli (emoji değil).

## Ses

Üç parça var, hepsi kod tarafından üretildi (`public/assets/audio/`):

- **night.mp3** — gece: alçak, gergin drone ve uzaktan gelen çan
- **day.mp3** — gündüz: sakin akor döngüsü
- **morning.mp3** — geceden güne geçişte çalan kısa jingle

Faz değişince parçalar yumuşak geçişle değişir. Üst çubuktaki ♪ düğmesi sesi
tamamen kapatır, yanındaki kaydırıcı seviyeyi ayarlar. İkisi de tarayıcıda saklanır.

Tarayıcılar izinsiz ses çalmaya izin vermediği için müzik ilk tıklamada başlar.

**Horoz sesi** istiyorsan `public/assets/audio/morning.mp3` dosyasının üzerine gerçek
bir kayıt yaz; kod dosya adını kullanıyor, başka değişiklik gerekmiyor.

## Botlar

Tek başına test etmek için moderatör lobideki düğmeleri kullanır:
**+1**, **+5**, **Doldur** (köyü sonuna kadar doldurur), **−1**, **Hepsini sil**. Botlar otomatik hazır olur; oyuncu listesinde "bot" rozetiyle
görünürler.

Botlar oyunu kendileri oynar: gece rollerini kullanır (hedefi rastgele seçer, gardiyan
idam kararı verir, survivor yelek giyer), gündüz oy verir, duruşmada evet/hayır der,
gardiyansa hapsedeceği kişiyi seçer ve arada sohbete kısa cümleler yazar. Her faz
değişiminde 2-7 saniye arası rastgele gecikmeyle hareket ederler.

Oyun başladıktan sonra bot eklenip çıkarılamaz.

## Moderatör yetkileri

- **Odadan atma:** oyuncu listesindeki ✕ düğmesi. Lobide de oyun sırasında da çalışır.
  Oyun sırasında atılan kişi haritadan kalkar; vampirlerin başıysa yerine biri geçer ve
  kazanma durumu yeniden hesaplanır.
- **Moderatörlük devri:** lobide ⇄ düğmesi.
- Ayarlar, rol dağılımı, bot yönetimi ve oyunu başlatma da moderatöre aittir.

## Ev sistemi

Köyde 16 ev yuvası var, her yuvada farklı bir ev tasarımı. Oyuncunun koltuk
numarası evini belirler:

```
Oyuncu (koltuk 1) → Ev 1 → Patika 1
Oyuncu (koltuk 2) → Ev 2 → Patika 2
...
```

12 oyuncu varsa 12 ev sahipli, kalan 4 ev boş durur.

**Yerleşim.** 16 ev, meydanı saran tek halkada, **yay uzunluğuna göre eşit aralıklı**.
Eşit açıyla dizildiğinde elipsin yanlarında sıkışıp üst üste biniyorlardı. Arka plan evi yok — öncelik
oyuncunun hareket alanı. Alt taraftaki evler kadrajın en altına
yakın durur (dikey yarıçap %34 fazla) ki aradaki alan karakterlere kalsın.

**Ölçek.** Karakter, kapı, ev ve rampa genişliği birbirine oranlı. Kapı yüksekliği
duvarın %58'i, genişliği kapının %66'sı; karakter bu kapıdan geçebilecek boyutta.
Ev ölçeği 0.92, karakter ölçeği 0.50.

**Kapı yönü.** Yolun yönü sabit; ev ona uyar. Her evin üç cephesi üretiliyor:

| Yol nereden geliyor | Kullanılan cephe |
|---|---|
| Aşağıdan | Ön cephe — kapı görünür |
| Yukarıdan | Arka cephe (`_b`) — kapı karşı tarafta, görünmez |
| Yandan | Yan profil (`_s`) — evin uzun yan duvarı, yatay mahyalı çatı, iki pencere; kapı görünmeyen tarafta |

Oyuncu arka cepheli evlere yürürken evin arkasında kayboluyor.

**Ev kapısından konumlanır.** `tools/make_houses.py` her cephenin kapı koordinatını
`houses/manifest.json` dosyasına yazar. Halka üzerindeki nokta evin merkezi değil
**kapısının duracağı yer**; sprite ona göre kaydırılır. Böylece yol her zaman kapıya
oturur — evin gövdesi kadrajdan taşsa bile sorun olmaz.

**Yollar.** Evler önden çizili, kapıları hep aşağı bakıyor. Bu yüzden her kapının
önünde boş bir sahanlık var ve yol oradan başlıyor. Meydanın altında kalan evlerde
yol önce yana kıvrılıp sonra meydana çıkıyor, evin içinden geçiyormuş gibi durmuyor.
Yollar ahşap: her evin kapısından meydanın kenarına **tek düz hat**. Kırılma, dönüş
veya ek yok — tek tileSprite, genişlik 62 piksel. Hem ev ucu hem meydan ucu yay
uzunluğuna göre eşit aralıklı yerleştirildiği için aralarındaki boşluk her yerde aynı.
Taş döşemenin altından çıkar.
Ağaç, çalı, çit ve taşlar yol hattına düşmüyor.

**Merkez alan.** Meydanın etrafında taş bordür var; sınır gözle görülür. Normal
oyuncular bordürün dışında, eşit aralıklı bir yayda duruyor ve içeriyi izliyor.
Merkeze yalnızca savunmaya çıkan veya asılmak üzere oylanan oyuncu giriyor —
kod tarafında da merkez konumu sadece sanığa atanıyor.

**Kimin evi olduğu** kapıdaki fenerden anlaşılır: oyuncunun seçtiği forma renginde
yanar. Boş evlerin kapısında fener yoktur.

## Hareket

Teleport yok, hepsi Phaser tween zinciri:

**Gece olunca** oyuncu meydandaki yerinden kalkar, meydan kenarına yürür, kendi
patikasına girer, ara noktaları geçerek kapıya varır, kapıda kısa bir giriş
animasyonuyla küçülüp kaybolur. Gece boyunca meydanda hiç karakter görünmez.

**Sabah olunca** kapıda belirir, patikayı ters yönde kullanır ve meydandaki
yerine geçer.

**Duruşmada** suçlanan oyuncu idam tahtasına yürür.

**İdam:** oylamayla ölen kişinin kafasına yukarıdan alevli bir top düşer, patlar,
kamera hafif sarsılır, karakter yanıp söner ve ruhu süzülerek yükselir. Ardından
karakter haritadan tamamen silinir.

**Gece ölümü:** karakter yana devrilir, toz kalkar, hayalet süzülür ve karakter
haritadan silinir. Ölü oyuncular sağdaki listede üstü çizili görünür.

Efekt sırasında karakterin derinliği kilitlenir ki darağacının arkasına düşmesin.

Yürürken koşma animasyonu, dururken idle oynar. Yön, hareket yönüne göre çevrilir.
Derinlik sırası her karede y konumuna göre güncellenir.

## Karakterler

`tools/make_characters.py` 16 karakter üretir: 8 kız, 8 erkek. Hepsi parça parça
çizilir (ten tonu, saç biçimi ve rengi, göz, gözlük, kıyafet, aksesuar), böylece
birbirinden ayırt edilebilir.

Kızlar: sarışın, esmer, gözlüklü, kumral, kızıl, cadı, başörtülü, topuzlu.
Erkekler: esmer, gözlüklü, kumral, ortadan ayrık saçlı, kel, sakallı, kasketli, şapkalı.

Her karakterin idle (4 kare) ve yürüme (6 kare) sayfası, bir de seçim ekranı için
portresi var. Önden çizilmiş; yürürken yön çevriliyor.

**Seçim:** giriş ekranında 16 portre yan yana. Başkasının aldığı karakter soluk ve
tıklanamaz görünür; `/api/lobby` ucu 2.5 saniyede bir kimin ne aldığını bildirir.
Sunucu da ayrıca kontrol eder, aynı karakteri iki kişi alamaz.

Yeniden üretmek için: `python3 tools/make_characters.py`

## Ev üreteci

`tools/make_houses.py` parametrik bir üreteç. Duvar malzemesi (ahşap / taş / sıva /
karışık), çatı biçimi (beşik, kırma, dik, kırık çatı, tek eğim), 6 çatı rengi, baca,
sundurma, balkon, pencere ve kapı çeşitleri kombinasyonundan 16 ayrı ev çıkarıyor.
Bazılarında odun yığını, çiçek tarhı, çalı, varil veya fener var.

Yeniden üretmek için: `python3 tools/make_houses.py`

## Telefon

**Yatay modda her şey tek ekranda.** Solda rol paneli (Rol / Görevler / Vasiyet
sekmeleri) ve sohbet, ortada köy, sağda oyuncu listesi ve eylem paneli. Sekme
değiştirmeye gerek yok. Dikey modda alttaki üç sekmeyle geçiş yapılır.

iOS Safari'de `height:100%` zinciri araç çubukları yüzünden kayıyordu; oyun kabı
artık `position: fixed` ve güvenli alan boşlukları uygulanıyor.

Panel gizlenince sahne kabı sıfır boyuta düşüyor ve o anda çizim yapılırsa WebGL karesi
bozulup oyun donuyordu. Artık kap küçüldüğünde çizim döngüsü uyutuluyor, büyüyünce
uyandırılıyor; ayrıca ekran döndürme sonrası birkaç kez tazeleniyor ve WebGL bağlamı
kaybolursa geri geldiğinde kendini toparlıyor.

## Sohbet

İki kanal var: **Köy** ve **Vampir**. "Hepsi" kanalı yok.

Vampir sekmesi sadece vampir tarafındakilere ve Casus'a görünür. Ölü vampirler
okuyabilir ama yazamaz — ölünce sohbet kanalı ölüler kanalına döner. Ölü ve kâhin
satırları Köy sekmesinde, yalnızca görmeye hakkı olanlara gösterilir.

## Bilinen sınırlar

- **Evlerin içi yok.** Kapılar büyük, önleri açık ve giriş/çıkış animasyonu var ama
  oyuncu içeride gezinemiyor. Gerçek iç mekân ayrı bir sahne gerektirir.

- **4 yönlü yürüme yok.** Tiny Swords karakterleri yandan çizilmiş; sağa-sola
  çevrilebiliyor ama yukarı-aşağı ayrı çizim yok.
- **Saç/yüz ayrı katman değil.** Karakterler tek parça sprite. 16 görünüm birbirinden
  siluet (pawn, warrior, archer, monk) ve renk (5 ton) ile ayrılıyor; saç ve yüzü tek
  tek değiştirmek bu paketle mümkün değil. Bunun için modüler bir set (LPC gibi) lazım,
  o da bütün görsel dili değiştirir.

## Sonraki adım

Oyun mekaniğini bu sahneye taşımak: oyuncuları gerçek listeye bağlamak, gece/gündüz
geçişi, eve yürüme, idam animasyonu, hedef seçimi.
