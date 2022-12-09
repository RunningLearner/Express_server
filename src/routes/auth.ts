import { isEmpty, validate } from "class-validator";
import { Request, Response, Router } from "express";
import User from "../entities/User";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import bcrypt from "bcryptjs";
import userMiddleware from "../middlewares/user";
import authMiddleware from "../middlewares/auth";

const mapErrors = (errors: Object[]) => {
  return errors.reduce((prev: any, err: any) => {
    prev[err.property] = Object.entries(err.constraints)[0][1];
    return prev;
  }, {});
};

const me = async (req: Request, res: Response) => {
  return res.json(res.locals.user);
};

const register = async (req: Request, res: Response) => {
  const { email, password, username } = req.body;

  try {
    let errors: any = {};

    //중복확인
    const emailUser = await User.findOneBy({ email });
    const usernameUser = await User.findOneBy({ username });

    //중복확인 시
    if (emailUser) errors.email = "이미 등록된 이메일입니다.";
    if (usernameUser) errors.username = "이미 등록된 사용자입니다.";

    if (Object.keys(errors).length > 0) {
      return res.status(400).json(errors);
    }

    const user = new User();
    user.email = email;
    user.username = username;
    user.password = password;

    errors = await validate(user);

    if (errors.length > 0) return res.status(400).json(mapErrors(errors));

    await user.save();
    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error });
  }
};

const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  try {
    let errors: any = {};

    if (isEmpty(username)) errors.username = "사용자 이름을 입력해주세요.";
    if (isEmpty(password)) errors.password = "비밀번호를 입력해주세요.";
    if (Object.keys(errors).length > 0) {
      return res.status(400).json(errors);
    }

    const user = await User.findOneBy({ username });

    if (!user)
      return res
        .status(404)
        .json({ username: "사용자 이름이 등록되지 않았습니다." });

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ password: "비밀번호가 잘못되었습니다." });
    }

    const token = jwt.sign({ username }, process.env.JWT_SECRET);

    res.set(
      "Set-Cookie",
      cookie.serialize("token", token, {
        httpOnly: true,
        // secure:,
        // sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      })
    );
    return res.json({ user, token });
  } catch (error) {
    console.error(error);
    return res.status(500).json(error);
  }
};

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.get("/me", userMiddleware, authMiddleware, me);

export default router;
