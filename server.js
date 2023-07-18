const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const mysql = require('mysql2');
const note = require('fs');
const { time } = require('console');
const cors = require('cors')
const path = require('path')
const router = express.Router();
const app = express();
const port = 4000;
app.use(cors());
// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });
app.use(bodyParser.urlencoded({ extended: true }));

// Configure bodyParser to parse JSON data
app.use(bodyParser.json());

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Ravi@1998',
  database: 'csir_db',
});

// Handle registration API endpoint
const sharp = require('sharp');



app.post('/register', upload.single('photo'), (req, res) => {
  const { email, idCardNumber } = req.body;
  console.log(req.body);


  const photoPath = req.file.path;
  const verification_status = "unverified";
  const verification_authority = "NA";
  const labCode = req.body.labCode;
  console.log(labCode)
  console.log("Photo Path: Line 41", photoPath);

  // Generate a unique file name for the output photo
  const outputPhotoPath = path.join(path.dirname(photoPath), `${Date.now()}.jpeg`);

  // Convert the photo to JPEG format
  sharp(photoPath)
    .jpeg({ quality: 80 }) // Set the desired quality (e.g., 80)
    .toFile(outputPhotoPath, (error, info) => {
      if (error) {
        console.error('Error converting photo to JPEG:', error);
        res.status(500).json({ message: 'Error registering user' });
        return;
      }
      const checkExistingUserQuery = 'SELECT * FROM mastertable1 WHERE email = ? OR cardnumber = ?';
      const checkExistingUserValues = [email, idCardNumber];

      pool.query(checkExistingUserQuery, checkExistingUserValues, (error, results) => {
        if (error) {
          console.error('Error checking existing user:', error);
          res.status(500).json({ message: 'Error registering user' });
          return;
        }

        if (results.length > 0) {
          const userData = results[0];
          console.log("User Data : " , userData);

          // Create the users table if it doesn't exist
          const createTableQuery = `CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            title VARCHAR(255) NOT NULL,
            fullName VARCHAR(255) NOT NULL,
            designation VARCHAR(255) NOT NULL,
            department VARCHAR(255) NOT NULL,
            LabNameCode VARCHAR(255) NOT NULL,
            CardNumber VARCHAR(255) NOT NULL,
            BloodGroup VARCHAR(255) NOT NULL,
            password VARCHAR(255) NOT NULL,
            photoPath VARCHAR(255) NOT NULL,
            email VARCHAR(50) NOT NULL,
            contact VARCHAR(15) NOT NULL,
            verification_status VARCHAR(255) NOT NULL,
            verification_authority VARCHAR(255) NOT NULL,
            division VARCHAR(20) NOT NULL,
            address VARCHAR(50) NOT NULL
          )`;

          pool.query(createTableQuery, (error) => {
            if (error) {
              console.error('Error creating users table:', error);
              res.status(500).json({ message: 'Error registering user' });
              return;
            }

            // Save the user data to the users table
            const insertUserDataQuery = 'INSERT INTO users SET ?';
            const insertUserDataValues = {
              ...userData,
              LabNameCode: labCode,
              photoPath: outputPhotoPath,
              verification_status: verification_status,
              verification_authority: verification_authority
            };

            pool.query(insertUserDataQuery, insertUserDataValues, (error, results) => {
              if (error) {
                console.error('Error inserting user data:', error);
                res.status(500).json({ message: 'Error registering user' });
              } else {
                res.status(200).json({ message: 'Registration successful' });
              }
            });
          });
        } else {
          // User with the same email or ID card number does not exist in the master table
          res.status(404).json({ message: 'User not found in master table' });
        }
      });
    });
});




// Serve the uploaded photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



//
app.post('/login', (req, res) => {
  console.log("Request Body: ", req.body);
  const { idCardNumber, password } = req.body;

  // Execute the SQL query to fetch the user from the database
  const query = 'SELECT * FROM users WHERE CardNumber = ?';
  const values = [idCardNumber];

  pool.query(query, values, (error, results) => {
    if (error) {
      console.error('Error authenticating user:', error);
      res.status(500).json({ message: 'Failed to authenticate' });
    } else {
      console.log(results);
      // Check if the query returned a matching user
      if (results.length === 1) {
        const user = results[0];

        // Compare the stored password with the provided password
        if (user.password === password) {
          console.log(user);
          console.log('User authenticated successfully');

          // Fetch the logo URL from the logo table using LabNameCode
          const logoQuery = 'SELECT * FROM labLogos WHERE LabNameCode = ?';
          const logoValues = [user.LabNameCode];

          pool.query(logoQuery, logoValues, (logoError, logoResults) => {
            if (logoError) {
              console.error('Error fetching logo:', logoError);
              res.status(500).json({ message: 'Failed to fetch logo' });
            } else {
              // Check if the query returned a matching logo
              if (logoResults.length === 1) {
                const logo = logoResults[0];

                // Create a user object with the necessary details including logo URL
                const userPayload = {
                  title: user.title,
                  name: user.fullName,
                  designation: user.designation,
                  division: user.Division,
                  lab: user.LabNameCode,
                  id: user.CardNumber,
                  photoUrl: `http://192.168.0.132:4000/${user.photoPath}`,
                  email: user.email,
                  contact: user.contact,
                  status: user.verification_status,
                  autho: user.verification_authority,
                  logoUrl: logo.logoUrl, // Add the logo URL to the userPayload
                  address: user.Address,
                  bGroup: user.BloodGroup
                };
                console.log("userPayload", userPayload);
                res.status(200).json({
                  message: 'Authentication successful',
                  user: userPayload,
                });
              } else {
                console.log('Logo not found');
                res.status(404).json({ message: 'Logo not found' });
              }
            }
          });
        } else {
          console.log('Invalid password');
          res.status(401).json({ message: 'Invalid password' });
        }
      } else {
        console.log('User not found');
        res.status(404).json({ message: 'User not found' });
      }
    }
  });
});

app.get('/users', cors() ,  (req, res) => {
  // Fetch user details from the database
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    const query = `
      SELECT * FROM users
      WHERE verification_status = 'unverified'
      AND verification_authority = 'NA'
    `;

    connection.query(query, (err, results) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }
      console.log(results);
      res.json(results);
    });
  });
});
app.put('/users/:userId/revoke', cors(), (req, res) => {
  const userId = req.params.userId;

  // Update the user in the database with the revoked verification status
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    const query = `
      UPDATE users
      SET verification_status = 'User Revoked'
      WHERE id = ?
    `;

    connection.query(query, [userId], (err, results) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error('Error revoking user:', err);
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }

      res.sendStatus(200);
    });
  });
});




app.get('/verified-users', cors(), (req, res) => {
  // Fetch verified user details from the database
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    const query = `
      SELECT * FROM users
      WHERE verification_status = 'verified'
    `;

    connection.query(query, (err, results) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error('Error fetching verified users:', err);
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }

      res.json(results);
    });
  });
});

app.get('/not-verified-users', cors(), (req, res) => {
  // Fetch not verified user details from the database
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    const query = `
      SELECT * FROM users
      WHERE verification_status = 'User Revoked'
    `;

    connection.query(query, (err, results) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error('Error fetching not verified users:', err);
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }

      res.json(results);
    });
  });
});


app.put('/users/:id/verify', (req, res) => {
  const { id } = req.params;

  // Update the user in the database
  const query = `UPDATE users SET verification_status = 'verified', verification_authority = 'Auth 1' WHERE id = ?`;
  pool.query(query, [id], (error, results) => {
    if (error) {
      console.log("PUT RESULT " , results);
      console.error('Error updating user:', error);
      return res.status(500).json({ error: 'Error updating user' });
    }
    console.log("PUT RESULT " , results);
    res.sendStatus(200);
  });
});

// OTP API{Registration}
const nodemailer = require('nodemailer');
const randomstring = require('randomstring');

app.post('/send-otp', (req, res) => {
  const { email } = req.body;
  const otp = randomstring.generate({ length: 4, charset: 'numeric' });

  sendOTP(email, otp)
    .then(() => {
      res.status(200).json({ otp: otp, message: 'OTP sent successfully' });
    })
    .catch(error => {
      console.error('Error sending OTP:', error);
      res.status(500).json({ message: 'Failed to send OTP' });
    });
});


async function sendOTP(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'ravikumarpandey1998@gmail.com',
        pass: 'prvlivkarvkgjmsg'
      }
    });

    const mailOptions = {
      from: 'ravikumarpandey1998@gmail.com',
      to: email,
      subject: 'OTP Verification',
      text: `Your OTP is: ${otp}`
    };

    await transporter.sendMail(mailOptions);

    console.log(mailOptions);
    console.log('OTP sent successfully');
  } catch (error) {
    throw error;
  }
}

// OTP API{LOGIN}
app.post('/request-otp', (req, res) => {
  const { idCardNumber } = req.body;
  const otp = randomstring.generate({ length: 4, charset: 'numeric' });
  pool.query('SELECT email from users where CardNumber = ?', [idCardNumber], (error, results, feilds) => {
    if (error) {
      console.error('Error Fetching email id from Database', error);
      res.status(500).json({ success: false, message: 'Failed to retreive email from server!' });
    } else if (results.length === 0) {
      console.log("No User Found with this Id Card Number");
      res.status(404).json({ success: false, message: 'No User Found' });
    } else {
      const email = results[0].email;
      sendOTP(email, otp)
        .then(() => {
          res.status(200).json({ success: true, otp: otp, message: 'OTP sent successfully' });
        })
        .catch(error => {
          console.error('Error sending OTP:', error);
          res.status(500).json({ success: false, message: 'Failed to send OTP' });
        });
    }
  });
});


async function sendOTP(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'ravikumarpandey1998@gmail.com',
        pass: 'prvlivkarvkgjmsg'
      }
    });

    const mailOptions = {
      from: 'ravikumarpandey1998@gmail.com',
      to: email,
      subject: 'OTP Verification for LOGIN',
      text: `Your OTP is: ${otp}`
    };

    await transporter.sendMail(mailOptions);

    console.log(mailOptions);
    console.log('OTP sent successfully');
  } catch (error) {
    throw error;
  }
}

  


app.get('/labnames', (req, res) => {
  // Execute the SQL query to fetch lab names from the Laboratory table
  const query = 'SELECT name FROM Laboratory';
  
  pool.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching lab names:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      // Extract lab names from the query results
      
      const labNames = results.map((result) => result.name);
  
      
      res.status(200).json(labNames);
    }
  });
});



// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
