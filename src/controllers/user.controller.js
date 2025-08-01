import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function signup(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ err: "Please provide all the credentials" });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ err: "Password must be of at least 8 characters long" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    return res.status(201).json({ msg: "Signup successfull", user });
  } catch (error) {
    console.log(error);
    ``;
    return res.status(500).json({ msg: "Something went wrong" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ err: "Please provide all the credentials" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ err: "Password must be of at least 8 characters long" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "User does not exists" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ msg: "Email or Password is incorrect" });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.profilePicture,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "24h",
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000,
    });

    const userData = {
      id: user?._id,
      name: user?.name,
      email: user?.email,
      profile: user?.profilePicture,
    };

    return res.status(200).json({ msg: "Logged In", userData, token });
  } catch (error) {
    return res.status(500).json({ msg: "Something went wrong" });
  }
}

export async function logout(req, res) {
  try {
    res.clearCookie("token");
    res.status(200).json({ msg: "Logged out successfully" });
  } catch (error) {
    return res.status(500).json({ msg: "Something went wrong in logging out" });
  }
}

export async function profile(req, res) {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(400).json({ msg: "User not found! Login again" });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ msg: "Something went wrong in fetching user details" });
  }
}
