const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export function uploadToCloudinary(file, folder = "healers/child-documents") {
  return new Promise((resolve, reject) => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      reject(new Error("Cloudinary is not configured in the app."));
      return;
    }

    const name = file.name || `upload-${Date.now()}`;
    const isPdf = file.mimeType === "application/pdf" || /\.pdf$/i.test(name);

    const body = new FormData();
    body.append("file", {
      uri: file.uri,
      name,
      type: file.mimeType || (isPdf ? "application/pdf" : "image/jpeg"),
    });
    body.append("upload_preset", UPLOAD_PRESET);
    body.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);
    xhr.timeout = 120000;

    xhr.onload = () => {
      let json = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
      }

      if (xhr.status >= 200 && xhr.status < 300 && json?.secure_url) {
        resolve({
          url: json.secure_url,
          publicId: json.public_id,
          resourceType: json.resource_type || "image",
          name,
          type: isPdf ? "pdf" : "image",
        });
      } else {
        reject(new Error(json?.error?.message || "Upload failed. Please try again."));
      }
    };

    xhr.onerror = () => reject(new Error("Network error. Check your connection."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Please try again."));

    xhr.send(body);
  });
}