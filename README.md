# Tacet

Tacet is a Firebase-powered attendance hub for bands, choirs, orchestras and other music groups.

## Included

- Email/password and Google authentication
- Password reset
- Dark mode by default with warm off-white light mode
- Global absences that apply across every joined group
- Member, Section Leader, Group Leader and Platform Admin roles
- Join codes and invitation links
- Events with Yes / No / Maybe responses
- Group announcements
- Group accent colours and Firebase Storage logo uploads
- Scheduled Gmail reports through Cloud Functions
- Firestore and Storage security rules
- Bounded Cloud Function scaling with zero minimum instances

## Automatic deployment

The workflow in `.github/workflows/deploy-firebase.yml` deploys the `main` branch to Firebase project `band-diary`.

Create a GitHub Actions repository secret named:

`FIREBASE_SERVICE_ACCOUNT_BAND_DIARY`

Its value must be the complete JSON for a Google Cloud service account that has permission to deploy Firebase Hosting, Firestore rules, Storage rules and Cloud Functions.

## Firebase setup

Enable Email/Password and Google authentication, create Firestore and Storage, and add the Gmail Function secrets:

```bash
firebase functions:secrets:set GMAIL_USER
firebase functions:secrets:set GMAIL_APP_PASSWORD
```

Use a Google App Password rather than your normal Gmail password.
