import twilio from 'twilio';
import patientModel from '../models/patientModel.js';
import { ApiError } from '../utils/ApiError.js';

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export const whatsappController = {
  async registerPatient(req, res, next) {
    try {
      const { name, phone, age, gender } = req.body;
      if (!name || !phone || !age || !gender) throw new ApiError(400, 'Missing required fields');
      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
      const patient = await patientModel.createPatient({ name, phone: formattedPhone, age, gender });
      res.status(201).json({ success: true, data: patient });
    } catch (error) {
      next(error);
    }
  },

  async sendWhatsAppMessage(req, res, next) {
    try {
      const { phone, message } = req.body;
      if (!phone || !message) throw new ApiError(400, 'Phone and message are required');
      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
      const patient = await patientModel.findPatientByPhone(formattedPhone);
      if (!patient) throw new ApiError(404, 'Patient not found');
      const twilioResponse = await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:${formattedPhone}`,
        body: message,
      });
      res.status(200).json({ success: true, data: { sid: twilioResponse.sid } });
    } catch (error) {
      next(error);
    }
  },
};