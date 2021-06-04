var mongoose = require("mongoose");
var Schema =  mongoose.Schema;
var PaymentDetails = new Schema({
    amount:{
        type:Number,
        required:true
    },
      customerId: {
          type:String,
          required:true
      },

      customerEmail: {
          type:String,
          required:true
      },

      customerPhone: {
          type:Number,
          required:true
      }
})

module.exports = mongoose.model('Payment', Payment);
module.exports = Payment;