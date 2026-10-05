/*google anlystic*/
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'UA-159957693-1');

 /*commend box*/

$(document).ready(function(){

 $('#comment_form').on('submit', function(event){
  event.preventDefault();
  var form_data = $(this).serialize();
  $.ajax({
   url:"add_comment.php",
   method:"POST",
   data:form_data,
   dataType:"JSON",
   success:function(data)
   {
    if(data.error != '')
    {
     $('#comment_form')[0].reset();
     $('#comment_message').html(data.error);
     $('#comment_id').val('0');
     load_comment();
    }
   }
  })
 });

 load_comment();

// retrive postid from form and sent the data to fetch_comment
 function load_comment()
 {
  var post_id = document.getElementById("comment_form").elements.namedItem("post_id").value;
  var ajax_data1 = "query=votecount&post_id=" + post_id;
  $.ajax({
   url:"fetch_comment.php",
   method:"POST",
   data: ajax_data1,
   dataType: "html",
   success:function(data)
   {
    $('#display_comment').html(data);
   }
  })
 }

 $(document).on('click', '.reply', function(){
  var comment_id = $(this).attr("id");
  $('#comment_id').val(comment_id);
  $('#comment_name').focus();
 });

});








/*share button*/
document.write('<script src="https://sharehulk.com/api/sharingbutton.php?type=horizontal&u=' + encodeURIComponent(document.location.href) + '"></scr' + 'ipt>');
window.addEventListener('load', () => {
				// noinspection JSUnresolvedVariable
				let audioCtx = new (window.AudioContext || window.webkitAudioContext)();

				var gainNode = audioCtx.createGain()
                gainNode.gain.value = 0.2
                gainNode.connect(audioCtx.destination)


				let xhr = new XMLHttpRequest();
				xhr.open('GET', 'Bulletin_music.mp3');
				xhr.responseType = 'arraybuffer';
				xhr.addEventListener('load', () => {
					let playsound = (audioBuffer) => {
						let source = audioCtx.createBufferSource();
						source.buffer = audioBuffer;
						source.connect(gainNode);
						source.loop = true;
						source.start();

						setTimeout(function () {
							let t = document.createElement('p');
							t.appendChild(document.createTextNode((new Date()).toLocaleString() + ': Sound played'));
							document.querySelector('.output').appendChild(t);
							playsound(audioBuffer);
						}, 1000 + Math.random()*2500);
					};

					audioCtx.decodeAudioData(xhr.response).then(playsound);
				});
				xhr.send();
			});

