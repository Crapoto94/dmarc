# DMARC Analyzer

Analyseur de rapports DMARC multi-domaines avec moissonnage Gmail automatique,
tableau de bord graphique, alertes de sécurité et recommandations.

## Fonctionnalités

### 📊 Tableau de bord
- Vue d'ensemble des emails analysés, taux d'authentification, périodes couvertes
- Graphiques : authentification (camembert), évolution temporelle (barres), sources IP
- Détail par domaine expéditeur : DKIM+SPF OK, DKIM seul, SPF seul, aucun
- Recommandations automatiques avec priorités (haute/moyenne/info)

### 🌐 Domaines
- Liste des domaines surveillés avec statistiques par domaine
- Ajout/suppression de domaines
- Détail des rapports par domaine

### 📄 Rapports DMARC
- Import de fichiers `.xml`, `.xml.gz`, `.zip`
- Scan de dossier pour import en masse
- Détail des enregistrements avec **titulaire de l'IP** (RDAP/whois)

### 🔔 Alertes
- Détection automatique des échecs DKIM/SPF
- Recommandations de configuration DMARC
- Acquittement individuel ou groupé

### ⚙️ Administration

#### Configuration Gmail (IMAP)
- Moissonnage automatique : `toutes les heures`
- Mot de passe d'application Gmail requis
- Messages déplacés dans dossier "DMARC Traités" après traitement
- Journal d'import consultable

#### Notifications email (SMTP)
- Alertes envoyées par email en cas d'activité suspecte
- Configuration SMTP (Gmail, Outlook, etc.)

#### Gestion des utilisateurs
- Rôles : **admin** (accès complet) / **viewer** (consultation)
- Compte par défaut : `admin` / `admin`
- Changement de mot de passe
- Création/suppression/modification des utilisateurs

## Installation

### Avec Docker (recommandé)

```bash
# Cloner le dépôt
git clone https://github.com/Crapoto94/dmarc.git
cd dmarc/dmarc-app

# Lancer l'application
docker compose up -d
```

Accès : `http://IP_SERVEUR:3200`

### Sans Docker (développement)

```bash
# Backend
cd backend
npm install
npm start          # → http://localhost:3201

# Frontend (autre terminal)
cd frontend
npm install
npm run dev        # → http://localhost:3200
```

## Configuration

### 1️⃣ Premier accès
- Identifiants par défaut : `admin` / `admin`
- **Changez le mot de passe immédiatement** dans Admin → Mot de passe

### 2️⃣ Moissonnage Gmail
1. Aller dans Admin → Configuration
2. Activer la [vérification en deux étapes](https://myaccount.google.com/security) Gmail
3. Créer un [mot de passe d'application](https://myaccount.google.com/apppasswords)
4. Renseigner l'adresse Gmail et le mot de passe d'application
5. Cliquer "Enregistrer" puis "Tester connexion IMAP"
6. Cliquer "Moissonner maintenant" pour un premier import

### 3️⃣ Notifications email
1. Configurer le serveur SMTP dans Admin → Configuration
2. Tester avec votre propre serveur SMTP (Gmail, Outlook, SendGrid, etc.)

## API REST

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/login` | Connexion |
| GET | `/api/auth/me` | Profil |
| GET | `/api/stats/global` | Statistiques globales |
| GET | `/api/stats/email-details` | Détail par domaine |
| GET | `/api/stats/recommendations` | Recommandations |
| GET | `/api/stats/timeline?days=90` | Évolution temporelle |
| GET | `/api/stats/sources?limit=20` | Top sources IP |
| GET | `/api/stats/unauthorized` | Activité non authentifiée |
| GET | `/api/domains` | Domaines surveillés |
| GET | `/api/reports` | Rapports DMARC |
| GET | `/api/alerts` | Alertes |
| GET | `/api/config` | Configuration |

## Déploiement Proxmox

```bash
# Sur le serveur Proxmox (LXC ou VM)
apt install docker.io docker-compose-v2
git clone https://github.com/Crapoto94/dmarc.git /opt/dmarc
cd /opt/dmarc/dmarc-app
docker compose up -d

# Ports exposés : 3200 (frontend) + 3201 (backend)
```

## Stack technique

- **Frontend** : Vite + React 18 + Recharts
- **Backend** : Node.js + Express + SQL.js (SQLite)
- **Conteneurisation** : Docker + Docker Compose
- **IMAP** : ImapFlow
- **Notifications** : Nodemailer

## Licence

MIT
