// Tiny, dependency-free module so this constant can be shared by store.js, firebase.js and memory.js
// without any of them importing each other (store.js dynamically imports the other two, so a shared
// constant living in either of those would create a circular import).
//
// Pass this as a field's value in set()/update()/batch() to remove that field entirely (e.g. deselecting
// an answer). Plain `undefined` can't do this: Firestore (and our own JSON-based cleanup) just drops an
// undefined key from the write instead of deleting it, silently leaving the old value in place.
export const DELETE_FIELD = '\u0000__delete_field__';
