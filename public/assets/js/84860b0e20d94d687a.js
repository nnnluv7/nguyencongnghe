
function splitString() {
  let input = document.getElementById("input").value;
  let nd1Elenment = document.getElementById('nd1');
  let result = [];
  for (let i = 0; i < input.length; i++) {
    if (input[i] != " ") {
  	nd1Elenment.value = input[i];
    window.print();
    }
  }
}
