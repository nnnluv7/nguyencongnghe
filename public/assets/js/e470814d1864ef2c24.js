
  
  textElement = document.getElementById('text');
  oriElement = document.getElementById('ori');
  ori1Element = document.getElementById('ori1');
  
  document.getElementById('text').addEventListener('keyup',function() {
  oriElement.value = textElement.value;
  ori1Element.value = textElement.value + "-1";
   
	}) 

