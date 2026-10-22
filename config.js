// ============================================================================
// R&D Quiz Arena - settings you edit after creating your Firebase project.
// Leave apiKey empty to run in DEMO MODE (sample data, nothing is saved online).
// ============================================================================
export const CONFIG = {
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  },
  // This account is always an Admin, even if the roles list is empty.
  // It must match the email in firestore.rules (see SETUP-GUIDE.md).
  bootstrapAdmin: 'saiteja.janumpally@databeat.io',
  domain: 'databeat.io',
  appName: 'R&D Quiz Arena'
};

export const DEMO = !CONFIG.firebase.apiKey;
