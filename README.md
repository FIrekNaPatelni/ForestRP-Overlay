# ForestRP Overlay

MDT i telefon ForestRP jako nakładki na Windows 10/11 x64. Licencja MIT.

## Instalacja

1. Pobierz `ForestRP-Overlay-1.3.0-x64.exe` z [najnowszego wydania](https://github.com/FIrekNaPatelni/ForestRP-Overlay/releases/latest).
2. Zamknij poprzednią wersję.
3. W instalatorze wybierz zakres instalacji, folder docelowy oraz skróty na pulpicie i w menu Start.
4. Na ostatniej stronie możesz uruchomić ForestRP Overlay.

## Sterowanie

- F6: pokaż / schowaj MDT.
- F7: pokaż / schowaj telefon.
- Esc: schowaj aktywny panel.
- F5 lub Ctrl+R: odśwież po potwierdzeniu.

Własny skrót: kliknij przycisk skrótu w ustawieniach, naciśnij klawisz lub kombinację i kliknij **Zapisz**. Obsługiwane są m.in. litery, cyfry, klawisze F1–F24 oraz Ctrl, Alt, Shift i Win. Esc anuluje przypisywanie; Esc, F5, Ctrl+R i wybrane skróty systemowe są zarezerwowane. Aplikacja zgłosi konflikt z innym programem bez utraty poprzedniego przypisania.

Przesuwaj telefon i MDT za górną ramkę. Rozmiar zmieniaj uchwytem w prawym dolnym rogu. Położenie i rozmiar zapisują się automatycznie, osobno dla każdego panelu. **Przywróć układ** ustawia domyślne rozmiary na monitorze kursora. Po odłączeniu monitora panele są dopasowywane do dostępnego ekranu.

## Roblox i pełny ekran

**Utrzymuj nad grą** włącza wyższy poziom always-on-top.

## Źródła i budowanie

Wymagane: Node.js 22, npm i Windows x64 do budowania instalatora.

```sh
npm ci
npm start
npm test
npm run test:smoke
npm run build
```

`npm run pack` tworzy aplikację bez instalatora. Wyniki trafiają do `dist/`.

Identyfikator instalacji i nazwy sesji zachowano dla zgodności aktualizacji. Przy pierwszym uruchomieniu 1.3.0 aplikacja wykrywa istniejący profil wcześniejszej wersji i używa go dalej, żeby zachować ustawienia i sesje. Nazwy widoczne w programie, instalatorze, pliku EXE i skrótach to **ForestRP Overlay**.

## Wydanie

Repozytorium docelowe: [FIrekNaPatelni/ForestRP-Overlay](https://github.com/FIrekNaPatelni/ForestRP-Overlay).

