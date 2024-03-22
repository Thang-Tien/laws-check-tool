const dotenv = require("dotenv");
dotenv.config({ path: '.env'});


var obj =  {
    a1: '1',
    a2: '2',
    a3: '3',
}

var specialAddAttribute = (object, addingAttribute, location) => {
    var objectValueArray = [];
    var temp2;
    for (var attribute in object) {   
        objectValueArray.push({[attribute]: object[attribute]});
    }

    index = 0;

    objectValueArray.splice(location, 0, addingAttribute);

    for (let i = 0; i < objectValueArray.length; i++) {
        temp2 = {...temp2, ...objectValueArray[i]};
    }

    return temp2;

}

obj = specialAddAttribute(obj, {'a4': '4'}, 2);
console.log(obj)

console.log(process.env.USER_NAME);
console.log(process.env.PASSWORD);