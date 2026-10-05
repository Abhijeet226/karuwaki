function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function getCsrfToken() {
  return getCookie('csrftoken') || document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
}

function initEditor() {
  if (typeof tinymce === 'undefined') {
    return;
  }

  // Guard: Only initialize if the content textarea is present on this page
  const targetTextarea = document.getElementById('id_content');
  if (!targetTextarea) {
    return;
  }

  // Prevent double-initialization
  if (tinymce.get('id_content')) {
    tinymce.get('id_content').remove();
  }

  // Detect Unfold Admin Dark/Light Theme dynamically
  const isDark = document.documentElement.classList.contains('dark') || 
                 (!document.documentElement.classList.contains('light') && window.matchMedia('(prefers-color-scheme: dark)').matches);

  tinymce.init({
    selector: "#id_content",
    license_key: 'gpl',
    height: 650,
    image_caption: true,
    image_advtab: true,
    paste_data_images: true,
    link_assume_external_targets: 'https',
    link_default_target: '_blank',
    block_formats: 'Paragraph=p; Heading 2=h2; Heading 3=h3; Heading 4=h4; Quote=blockquote; Code Block=pre',
    relative_urls: false,
    remove_script_host: false,
    convert_urls: false,
    branding: false,
    promotion: false,
    skin: isDark ? 'oxide-dark' : 'oxide',
    content_css: isDark ? 'dark' : 'default',
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'wordcount', 'codesample'
    ],
    toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough subscript superscript | ' +
      'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | ' +
      'link image media table codesample hr blockquote | forecolor backcolor removeformat | code fullscreen preview',
    entity_encoding: 'raw',
    directionality: 'ltr',
    content_style: "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Oriya:wght@400;500;600;700&family=Noto+Serif+Oriya:wght@400;600;700&display=swap'); body { font-family: 'Noto Sans Oriya', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; line-height: 1.85; font-size: 16px; }",
    font_family_formats: 'Odia (Noto Sans)=Noto Sans Oriya, sans-serif; Odia Serif (Noto Serif)=Noto Serif Oriya, serif; Plus Jakarta Sans=Plus Jakarta Sans, sans-serif; Arial=arial,helvetica,sans-serif; Georgia=georgia,palatino,serif;',
    menubar: 'file edit view insert format tools table',
    setup: function (editor) {
      // Keep underlying textarea in 100% real-time sync with editor to prevent empty form submissions
      editor.on('change keyup NodeChange SetContent', function () {
        editor.save();
      });
    },
    images_upload_handler: function (blobInfo, progress) {
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        xhr.open('POST', '/blog/image_upload/', true);
        var CSRF_TOKEN = getCsrfToken();
        if (CSRF_TOKEN) {
          xhr.setRequestHeader("X-CSRFToken", CSRF_TOKEN);
        }

        xhr.upload.onprogress = function (e) {
          if (progress) progress(e.loaded / e.total * 100);
        };

        xhr.onload = function () {
          if (xhr.status < 200 || xhr.status >= 300) {
            reject('HTTP Error: ' + xhr.status);
            return;
          }
          try {
            var json = JSON.parse(xhr.responseText);
            if (!json || typeof json.location != 'string') {
              reject('Invalid JSON response: ' + xhr.responseText);
              return;
            }
            resolve(json.location);
          } catch (e) {
            reject('Failed to parse JSON: ' + e.message);
          }
        };

        xhr.onerror = function () {
          reject('Image upload failed due to a network error.');
        };

        var formData = new FormData();
        formData.append('file', blobInfo.blob(), blobInfo.filename());
        xhr.send(formData);
      });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditor);
} else {
  initEditor();
}