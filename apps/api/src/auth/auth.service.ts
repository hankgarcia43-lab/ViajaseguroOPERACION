import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DriverProfilesService } from '../driver-profiles/driver-profiles.service';
import { PassengerProfilesService } from '../passenger-profiles/passenger-profiles.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDriverDto } from './dto/register-driver.dto';
import { RegisterPassengerDto } from './dto/register-passenger.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly driverProfilesService: DriverProfilesService,
    private readonly passengerProfilesService: PassengerProfilesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async registerPassenger(dto: RegisterPassengerDto) {
    await this.ensureEmailIsAvailable(dto.email);

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.createUser({
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email,
      passwordHash,
      role: 'passenger',
      verificationStatus: 'pending',
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: dto.emergencyContactPhone
    });

    await this.passengerProfilesService.createForUser(user.id);

    return this.createAuthResponse(user.id, user.email, user.role, user.fullName);
  }

  async registerDriver(dto: RegisterDriverDto) {
    await this.ensureEmailIsAvailable(dto.email);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const autoApprove = this.shouldAutoApproveDrivers();

    const user = await this.usersService.createUser({
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email,
      passwordHash,
      role: 'driver',
      verificationStatus: autoApprove ? 'approved' : 'pending',
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: dto.emergencyContactPhone
    });

    await this.driverProfilesService.createForUser(user.id, autoApprove ? 'approved' : 'pending');

    return this.createAuthResponse(user.id, user.email, user.role, user.fullName);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (String((user as any).operationalStatus || 'active').toLowerCase() === 'suspended') {
      throw new UnauthorizedException('Cuenta suspendida. Contacta a administracion.');
    }
    return this.createAuthResponse(user.id, user.email, user.role, user.fullName);
  }

  async me(userId: string) {
    return this.usersService.getCurrentUserProfile(userId);
  }

  private async ensureEmailIsAvailable(email: string) {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }
  }

  private shouldAutoApproveDrivers() {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development').toLowerCase();
    const autoApproveFlag = this.configService.get<string>('AUTO_APPROVE_DRIVERS', 'false').toLowerCase();
    const bypassFlag = this.configService
      .get<string>('ENABLE_DEV_DRIVER_AUTO_APPROVE_BYPASS', 'false')
      .toLowerCase();

    // Bypass temporal SOLO para desarrollo local y solo si se habilitan ambas flags.
    return nodeEnv !== 'production' && autoApproveFlag === 'true' && bypassFlag === 'true';
  }

  private createAuthResponse(userId: string, email: string, role: string, fullName: string) {
    const roleValue = this.usersService.mapRole(role);

    const payload = {
      sub: userId,
      email,
      role: roleValue
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: userId,
        email,
        fullName,
        role: roleValue
      }
    };
  }
}

