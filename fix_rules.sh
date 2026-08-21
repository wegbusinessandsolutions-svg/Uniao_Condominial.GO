sed -i "s/function isFinanceiro() {/function isFinanceiro() {\n      return isStaff();\n    }\n\n    function OLD_isFinanceiro() {/" firestore.rules
sed -i "s/function isComercial() {/function isComercial() {\n      return isStaff();\n    }\n\n    function OLD_isComercial() {/" firestore.rules
sed -i "s/function isExpedicao() {/function isExpedicao() {\n      return isStaff();\n    }\n\n    function OLD_isExpedicao() {/" firestore.rules
