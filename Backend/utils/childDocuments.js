
const cloudinary = require("../config/cloudinary");

const DOC_KEYS = ["form", "birthCertificate", "slc","cnicFront", "cnicBack"];
const CLOUD_PREFIX = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`;

exports.calcAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;

  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return Math.max(age, 0);
};

const cleanDoc = (doc) => {
  if (!doc || typeof doc.url !== "string" || !doc.url.startsWith(CLOUD_PREFIX)) {
    return null;
  }
  return {
    url: doc.url,
    publicId: doc.publicId || null,
    resourceType: ["image", "raw", "video"].includes(doc.resourceType)
      ? doc.resourceType
      : "image",
    name: doc.name || null,
    type: ["image", "pdf"].includes(doc.type) ? doc.type : null,
  };
};

exports.sanitizeDocuments = (input = {}) =>
  DOC_KEYS.reduce((acc, key) => {
    acc[key] = cleanDoc(input?.[key]);
    return acc;
  }, {});

exports.removedDocuments = (oldDocs = {}, newDocs = {}) =>
  DOC_KEYS.filter(
    (key) => oldDocs?.[key]?.publicId && oldDocs[key].publicId !== newDocs?.[key]?.publicId,
  ).map((key) => oldDocs[key]);

exports.destroyDocuments = (docs = []) =>
  Promise.allSettled(
    docs
      .filter((d) => d?.publicId)
      .map((d) =>
        cloudinary.uploader.destroy(d.publicId, {
          resource_type: d.resourceType || "image",
        }),
      ),
  );
exports.confirmDocuments = (docs = {}) => {
  const byType = {};
  Object.values(docs)
    .filter((d) => d?.publicId)
    .forEach((d) => {
      (byType[d.resourceType || "image"] ||= []).push(d.publicId);
    });

  return Promise.allSettled(
    Object.entries(byType).map(([type, ids]) =>
      cloudinary.uploader.remove_tag("pending", ids, { resource_type: type })
    )
  );
};