// ============================================================================
// R&D Quiz Arena - settings you edit after creating your Firebase project.
// Leave apiKey empty to run in DEMO MODE (sample data, nothing is saved online).
// ============================================================================
export const CONFIG = {
  firebase: {
    apiKey: 'AIzaSyAqHEuJr8Cxn-IVvkM1F3J3aQkY1buDUEw',
    authDomain: 'rnd-quiz-tool.firebaseapp.com',
    projectId: 'rnd-quiz-tool',
    storageBucket: 'rnd-quiz-tool.firebasestorage.app',
    messagingSenderId: '324556075168',
    appId: '1:324556075168:web:57f12010b09198a2b259c5'
  },
  // This account is always an Admin, even if the roles list is empty.
  // It must match the email in firestore.rules (see SETUP-GUIDE.md).
  bootstrapAdmin: 'saiteja.janumpally@databeat.io',
  domain: 'databeat.io',
  appName: 'R&D Quiz Arena'
};

export const DEMO = !CONFIG.firebase.apiKey;
