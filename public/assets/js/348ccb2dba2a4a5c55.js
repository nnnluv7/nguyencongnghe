
  
  var entryTitle = document.querySelector('.entry-title');
  var inputElement = document.createElement('div');
  inputElement.className = 'custom-input';

  var innerInput = document.createElement('input');
  innerInput.type = 'number';
  innerInput.value = 10;
  innerInput.id = 'inputMax';

  inputElement.appendChild(innerInput);
  entryTitle.appendChild(inputElement);  
  
  	
  
  function generateRandomNumbers() {
    var maxElement = document.getElementById('inputMax');
    var max = maxElement.value - 1;
    console.log(max);
    var num1 = getRandomNumber(max);
    var num2 = getRandomNumber(max + 1 - num1);
    return { num1, num2 };
  }

  function getRandomNumber(max) {
    return Math.floor(Math.random() * max) + 1;
  }

  // Function to fill the number1 and number2 elements and calculate the sum
  function fillNumbersAndSum() {
    var rows = document.querySelectorAll('.row');

    rows.forEach(function(row, index) {
      var number1Element = row.querySelector('.number1');
      var number2Element = row.querySelector('.number2');
      var resultElement = row.querySelector('.result');

      var { num1, num2 } = generateRandomNumbers();

      number1Element.textContent = num1;
      number2Element.textContent = num2;

      var sum = num1 + num2;

    });
  }

  // Function to check the answers
  function checkAnswers() {
    var rows = document.querySelectorAll('.row');
    var allCorrect = true;

    // Loop through each row
    rows.forEach(function(row, index) {
      var resultElement = row.querySelector('.result');
      var number1Element = row.querySelector('.number1');
      var number2Element = row.querySelector('.number2');
      var feedbackElement = document.getElementById('feedback' + (index + 1));

      // Get the user's input
      var userAnswer = parseInt(resultElement.value) || 0;

      // Get the correct answer
      var correctAnswer = parseInt(number1Element.textContent) + parseInt(number2Element.textContent);

      // Check if the user's answer is correct
      if (userAnswer !== correctAnswer) {
        allCorrect = false;
        resultElement.style.borderColor = 'red';
        feedbackElement.textContent = 'Sai!';
        feedbackElement.className = 'feedback incorrect';
      } else {
        resultElement.style.borderColor = '';
        feedbackElement.textContent = 'Đúng!';
        feedbackElement.className = 'feedback correct';
      }
    });

    
  }

  // Function to generate new exercise with random numbers
  function generateNewExercise() {
    // Clear feedback messages
    var feedbackElements = document.querySelectorAll('.feedback');
      feedbackElements.forEach(function(feedbackElement) {
      feedbackElement.textContent = '';
      feedbackElement.className = 'feedback';
    });

    // Clear user input and result input styles
    var resultElements = document.querySelectorAll('.result');
      resultElements.forEach(function(resultElement) {
      resultElement.value = '';
      resultElement.style.borderColor = '';
    });

    // Fill new random numbers
    fillNumbersAndSum();
  }

  // Call the function to fill numbers and sums when the page loads
  fillNumbersAndSum();
  
  
