# Preuves — ThomasKGroupe

Fichiers texte générés (acceptables si le prof veut des screenshots : copier-coller ou capture du terminal).

| Fichier | Étape |
|---------|--------|
| `sortie-capture.txt` | 1–7 (`./capture.sh`) |
| `etape1-paiement.txt` | 1 paiement (`npm run preuves:paiement`) |
| `etape8-tests-verts.txt` | 8 tests OK |
| `etape8-test-sabotage-rouge.txt` | 8 test rouge après sabotage |

```bash
npm start                    # terminal 1
./preuves/capture.sh | tee preuves/sortie-capture.txt
npm run preuves:paiement     # si bloc paiement vide (redémarrer API si 429)
npm run preuves:tests        # étape 8
```