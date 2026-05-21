require('pathlra-aliaser')();

const logger = require('@logger');
const { db, isFirebaseReady } = require('@firebase-client-core_utils');
const { deepCloneForFirebase } = require('@firebase-clone-core_utils');
const admin = require('firebase-admin');

async function saveComplaintToFirebase(complaint) {
    if (!isFirebaseReady || !db) {
        logger.warn('Firebase Not Available Complaint Not Saved');
        return false;
    }
    try {
        const newComplaintRef = db.ref('complaints').push();
        const cleanComplaint = deepCloneForFirebase({
            ...complaint,
            complaintId: newComplaintRef.key,
            submittedAt: admin.database.ServerValue.TIMESTAMP,
        });
        await newComplaintRef.set(cleanComplaint);
        logger.db('Complaint Saved To Firebase With ID ' + newComplaintRef.key);
        return true;
    } catch (error) {
        logger.error('Error Saving Complaint To Firebase');
        return false;
    }
}

module.exports.saveComplaintToFirebase = saveComplaintToFirebase;
