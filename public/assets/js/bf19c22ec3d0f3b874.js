
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
      var num1 = getRandomNumber(10);
      var num2 = getRandomNumber(10);
      while (num1 === num2) {
        num2 = getRandomNumber(10);
      }
      return { num1, num2 };
    }

    function getRandomNumber(max) {
      return Math.floor(Math.random() * max) + 1;
    }

    function fillNumbersAndSum() {
      var rows = document.querySelectorAll('.row');

      rows.forEach(function(row, index) {
        var number1Element = row.querySelector('.number1');
        var number2Element = row.querySelector('.number2');
        var resultElement = row.querySelector('.result');

        var { num1, num2 } = generateRandomNumbers();

        number1Element.textContent = num1;
        number2Element.textContent = num2;
      });
    }

    function checkAnswers() {
      var rows = document.querySelectorAll('.row');
      var allCorrect = true;

      rows.forEach(function(row, index) {
        var resultElement = row.querySelector('.result');
        var number1Element = row.querySelector('.number1');
        var number2Element = row.querySelector('.number2');
        var feedbackElement = document.getElementById('feedback' + (index + 1));

        var userAnswer = resultElement.value;
        var correctAnswer = (parseInt(number1Element.textContent) > parseInt(number2Element.textContent)) ? 'greater' : 'less';

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

    function generateNewExercise() {
      var feedbackElements = document.querySelectorAll('.feedback');
      feedbackElements.forEach(function(feedbackElement) {
        feedbackElement.textContent = '';
        feedbackElement.className = 'feedback';
      });

      var resultElements = document.querySelectorAll('.result');
      resultElements.forEach(function(resultElement) {
        resultElement.value = '';
        resultElement.style.borderColor = '';
      });

      fillNumbersAndSum();
    }

    fillNumbersAndSum();
  