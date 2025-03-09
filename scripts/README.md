# Script de Surveillance des Téléchargements

Ce script Python surveille le dossier `Téléchargements` (Downloads) de l'utilisateur et déplace automatiquement les fichiers qui se terminent par `.data.json` vers le dossier `./client/public/data/` de l'application.

## Fonctionnalités

- Surveillance en temps réel du dossier Téléchargements
- Déplacement des fichiers `.data.json` vers le dossier cible
- Remplacement des fichiers existants avec le même nom
- Fonctionne sur Windows, macOS et Linux

## Prérequis

Pour exécuter ce script, vous devez avoir Python 3 installé ainsi que les dépendances requises.

```bash
pip install -r requirements.txt
```

## Utilisation

Pour lancer le script manuellement :

```bash
python watch_downloads.py
```

Pour configurer le script afin qu'il démarre automatiquement avec l'application, vous pouvez :

### Sur Windows
- Créer un raccourci du script dans le dossier de démarrage de Windows
- Ou configurer une tâche planifiée

### Sur macOS
- Créer un fichier .plist dans ~/Library/LaunchAgents
- Ou utiliser l'application Automator pour créer un service de connexion

### Sur Linux
- Ajouter le script à votre fichier .bashrc ou .profile
- Ou créer un service systemd

## Arrêt du script

Pour arrêter le script, appuyez sur Ctrl+C dans le terminal où il s'exécute.

## Comportement

- Le script vérifie d'abord si des fichiers .data.json sont déjà présents dans le dossier Téléchargements et les déplace.
- Ensuite, il surveille en continu les nouveaux fichiers et les modifications.
- Chaque fichier traité est d'abord copié vers la destination, puis supprimé de la source. 